import { Request, Response, Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { AppError } from '@/middlewares/errorHandler';
import { prisma } from '@/lib/prisma';

const PUBLIC_FIELDS = { id: true, slug: true, title: true, description: true, category: true } as const;

// Members: only what the admin has switched on, in the admin's order.
export const toolsRouter = Router();

toolsRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const tools = await prisma.fitnessTool.findMany({ where: { isEnabled: true }, orderBy: { position: 'asc' }, select: PUBLIC_FIELDS });
    res.json({ tools });
  })
);

toolsRouter.get(
  '/:slug',
  validate(z.object({ params: z.object({ slug: z.string().min(1).max(40) }) })),
  asyncHandler(async (req: Request, res: Response) => {
    const tool = await prisma.fitnessTool.findFirst({ where: { slug: req.params.slug, isEnabled: true }, select: PUBLIC_FIELDS });
    if (!tool) throw new AppError('This tool is not available', 404);
    res.json({ tool });
  })
);

export const adminToolsRouter = Router();
adminToolsRouter.use(requireAuth, requireRole(Role.ADMIN));

adminToolsRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ tools: await prisma.fitnessTool.findMany({ orderBy: { position: 'asc' } }) });
  })
);

adminToolsRouter.patch(
  '/:id',
  validate(
    z.object({
      params: z.object({ id: z.string().uuid() }),
      body: z
        .object({
          isEnabled: z.boolean().optional(),
          title: z.string().trim().min(1, 'Title is required').max(60).optional(),
          description: z.string().trim().min(1, 'Description is required').max(160).optional(),
        })
        .refine((b) => Object.keys(b).length > 0, 'Nothing to update'),
    })
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const exists = await prisma.fitnessTool.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new AppError('Tool not found', 404);
    res.json({ tool: await prisma.fitnessTool.update({ where: { id: req.params.id }, data: req.body }) });
  })
);

// The full list of ids in the new order — partial lists are rejected so two
// admins reordering at once can't leave gaps or duplicate positions.
adminToolsRouter.put(
  '/order',
  validate(z.object({ body: z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }) })),
  asyncHandler(async (req: Request, res: Response) => {
    const ids: string[] = req.body.ids;
    const all = await prisma.fitnessTool.findMany({ select: { id: true } });
    const known = new Set(all.map((t) => t.id));
    if (new Set(ids).size !== ids.length || ids.length !== known.size || !ids.every((id) => known.has(id))) {
      throw new AppError('Send every tool exactly once', 422);
    }
    await prisma.$transaction(ids.map((id, position) => prisma.fitnessTool.update({ where: { id }, data: { position } })));
    res.json({ tools: await prisma.fitnessTool.findMany({ orderBy: { position: 'asc' } }) });
  })
);
