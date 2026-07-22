import { Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth } from '@/middlewares/auth';
import * as service from '@/features/payments/payments.service';
import { sendInvoicePdf } from '@/features/payments/invoice-pdf';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ payments: await service.listMyPayments(req.user!.id) });
  })
);

const invoiceParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

paymentsRouter.get(
  '/me/:id/invoice',
  validate(invoiceParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await service.getInvoice(req.user!.id, req.params.id));
  })
);

paymentsRouter.get(
  '/me/:id/invoice.pdf',
  validate(invoiceParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const invoice = await service.getInvoice(req.user!.id, req.params.id);
    sendInvoicePdf(res, invoice);
  })
);
