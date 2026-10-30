import { Response, Router } from 'express';
import { PaymentGateway, Role } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '@/middlewares/errorHandler';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import { buildInvoice } from '@/features/payments/payments.service';
import { sendInvoicePdf } from '@/features/payments/invoice-pdf';
import * as crm from '@/features/admin-users/member-crm.service';

// Front-desk CRM actions on one member: /api/v1/admin/users/:id/...
// Every non-GET request here is written to the audit log (with its body, so
// `reason` fields are kept) by the admin audit middleware.
export const adminMemberCrmRouter = Router();
adminMemberCrmRouter.use(requireAuth, requireRole(Role.ADMIN));

const idParams = z.object({ id: z.string().uuid() });
const withBody = <T extends z.ZodTypeAny>(body: T) => validate(z.object({ params: idParams, body }));
const idOnly = validate(z.object({ params: idParams }));

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,17}$/, 'Enter a valid phone number, e.g. +91 98765 43210')
  .transform((v) => v.replace(/[\s-]/g, ''));
const optional = <T extends z.ZodTypeAny>(schema: T) => z.union([schema, z.literal('').transform(() => null), z.null()]).optional();
const reason = z.string().trim().min(3, 'Give a short reason').max(200);
const futureDate = z.coerce.date();

function forbidSelf(req: AuthedRequest, action: string) {
  if (req.params.id === req.user!.id) throw new AppError(`You can't ${action} your own account`, 400);
}

adminMemberCrmRouter.patch(
  '/:id/profile',
  withBody(
    z
      .object({
        name: z.string().trim().min(1, 'Name is required').max(80).optional(),
        age: z.number().int().min(10).max(100).nullable().optional(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
        heightCm: z.number().min(100).max(250).nullable().optional(),
        targetWeightKg: z.number().min(25).max(300).nullable().optional(),
        phone: optional(phone),
        emergencyContactName: optional(z.string().trim().max(80)),
        emergencyContactPhone: optional(phone),
        emergencyContactRelation: optional(z.string().trim().max(40)),
      })
      .refine((b) => Object.keys(b).length > 0, 'Nothing to update')
  ),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await crm.updateMemberProfile(req.params.id, req.body);
    res.json({ ok: true });
  })
);

adminMemberCrmRouter.put(
  '/:id/tags',
  withBody(z.object({ tags: z.array(z.string().trim().min(1).max(24)).max(12, 'At most 12 tags') })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ tags: await crm.setTags(req.params.id, req.body.tags) });
  })
);

adminMemberCrmRouter.put(
  '/:id/facility',
  withBody(
    z.object({
      lockerNumber: optional(z.string().trim().max(12).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and dashes only')),
      rfidTagId: optional(z.string().trim().min(4).max(32).regex(/^[A-Za-z0-9:-]+$/, 'Letters, numbers, colons and dashes only')),
    })
  ),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await crm.setFacility(req.params.id, req.body);
    res.json({ ok: true });
  })
);

adminMemberCrmRouter.post(
  '/:id/check-in',
  idOnly,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json({ attendance: await crm.manualCheckIn(req.user!.id, req.params.id) });
  })
);

adminMemberCrmRouter.post(
  '/:id/membership/extend',
  withBody(z.object({ days: z.number().int().min(1).max(365), reason: reason.optional() })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ membership: await crm.extendMembership(req.params.id, req.body.days) });
  })
);

adminMemberCrmRouter.post(
  '/:id/membership/freeze',
  withBody(
    z.object({
      resumeAt: futureDate.refine((d) => d.getTime() <= Date.now() + 180 * 24 * 60 * 60 * 1000, 'A freeze can last at most 180 days'),
      reason: reason.optional(),
    })
  ),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ membership: await crm.freezeMembership(req.params.id, req.body.resumeAt) });
  })
);

adminMemberCrmRouter.post(
  '/:id/membership/unfreeze',
  idOnly,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ membership: await crm.unfreezeMembership(req.params.id) });
  })
);

adminMemberCrmRouter.post(
  '/:id/membership/cancel',
  withBody(z.object({ reason })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ membership: await crm.cancelMembership(req.params.id) });
  })
);

const DESK_METHODS = [PaymentGateway.CASH, PaymentGateway.UPI, PaymentGateway.CARD, PaymentGateway.RAZORPAY] as const;

adminMemberCrmRouter.post(
  '/:id/payments',
  withBody(
    z.object({
      planId: z.string().uuid('Pick a plan'),
      amount: z.number().min(0).max(1_000_000),
      method: z.enum(DESK_METHODS),
      reference: optional(z.string().trim().max(60)),
      note: optional(z.string().trim().max(200)),
    })
  ),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json({ payment: await crm.recordPayment(req.user!.id, req.params.id, req.body) });
  })
);

adminMemberCrmRouter.get(
  '/:id/payments',
  idOnly,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await crm.listPayments(req.params.id, parsePagination(req.query as Record<string, unknown>)));
  })
);

adminMemberCrmRouter.get(
  '/:id/payments/:paymentId/invoice',
  validate(z.object({ params: idParams.extend({ paymentId: z.string().uuid() }) })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    sendInvoicePdf(res, await buildInvoice(req.params.id, req.params.paymentId));
  })
);

adminMemberCrmRouter.get(
  '/:id/visits',
  idOnly,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await crm.listVisits(req.params.id, parsePagination(req.query as Record<string, unknown>)));
  })
);

adminMemberCrmRouter.put(
  '/:id/pt/package',
  withBody(z.object({ total: z.number().int().min(0).max(500) })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await crm.setPtPackage(req.params.id, req.body.total);
    res.json({ ok: true });
  })
);

adminMemberCrmRouter.post(
  '/:id/pt/complete',
  idOnly,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json({ session: await crm.completePtSession(req.user!.id, req.params.id) });
  })
);

adminMemberCrmRouter.post(
  '/:id/nudge',
  withBody(z.object({ kind: z.enum(['INACTIVE', 'EXPIRING']) })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json({ notification: await crm.sendNudge(req.params.id, req.body.kind) });
  })
);

adminMemberCrmRouter.post(
  '/:id/sessions/revoke',
  withBody(z.object({ reason })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    forbidSelf(req, 'sign out');
    res.json({ revoked: await crm.revokeSessions(req.params.id) });
  })
);

adminMemberCrmRouter.post(
  '/:id/resend-verification',
  idOnly,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const email = await crm.resendVerification(req.params.id);
    res.json({ message: `Verification code sent to ${email}` });
  })
);

adminMemberCrmRouter.get(
  '/:id/notes',
  idOnly,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ notes: await crm.listNotes(req.params.id) });
  })
);

const noteBody = z.string().trim().min(1, 'Write something').max(2000);

adminMemberCrmRouter.post(
  '/:id/notes',
  withBody(z.object({ body: noteBody, followUpDate: futureDate.nullable().optional() })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json({ note: await crm.addNote(req.user!.id, req.params.id, req.body.body, req.body.followUpDate) });
  })
);

adminMemberCrmRouter.patch(
  '/:id/notes/:noteId',
  validate(
    z.object({
      params: idParams.extend({ noteId: z.string().uuid() }),
      body: z
        .object({ body: noteBody.optional(), followUpDate: futureDate.nullable().optional(), isDone: z.boolean().optional() })
        .refine((b) => Object.keys(b).length > 0, 'Nothing to update'),
    })
  ),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ note: await crm.updateNote(req.params.id, req.params.noteId, req.body) });
  })
);

adminMemberCrmRouter.delete(
  '/:id/notes/:noteId',
  validate(z.object({ params: idParams.extend({ noteId: z.string().uuid() }) })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await crm.deleteNote(req.params.id, req.params.noteId);
    res.status(204).send();
  })
);

// POST, not GET, so every reveal lands in the audit log.
adminMemberCrmRouter.post(
  '/:id/medical/reveal',
  idOnly,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ medical: await crm.revealMedical(req.params.id) });
  })
);

const healthList = z.array(z.string().trim().min(1).max(80)).max(20);

adminMemberCrmRouter.patch(
  '/:id/medical',
  withBody(z.object({ medicalConditions: healthList.optional(), allergies: healthList.optional(), medicalNotes: optional(z.string().trim().max(2000)) })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await crm.updateMedical(req.params.id, req.body);
    res.json({ ok: true });
  })
);

adminMemberCrmRouter.get(
  '/:id/timeline',
  validate(z.object({ params: idParams, query: z.object({ before: z.string().datetime().optional() }) })),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;
    res.json(await crm.getTimeline(req.params.id, before));
  })
);
