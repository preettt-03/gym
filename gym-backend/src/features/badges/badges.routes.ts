import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/badges/badges.service';
import * as schemas from '@/features/badges/badges.schemas';

export const badgesRouter = Router();
badgesRouter.get(
  '/',
  asyncHandler(async (_req, res) => res.json({ badges: await controller.listBadges() }))
);
badgesRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ badges: await controller.listMyBadges(req.user!.id) });
  })
);

export const adminBadgesRouter = Router();
adminBadgesRouter.use(requireAuth, requireRole(Role.ADMIN));
adminBadgesRouter.post(
  '/',
  validate(schemas.createBadgeSchema),
  asyncHandler(async (req, res) => res.status(201).json({ badge: await controller.createBadge(req.body) }))
);
adminBadgesRouter.patch(
  '/:id',
  validate(schemas.updateBadgeSchema),
  asyncHandler(async (req, res) => res.json({ badge: await controller.updateBadge(req.params.id, req.body) }))
);
adminBadgesRouter.delete(
  '/:id',
  validate(schemas.badgeIdParamSchema),
  asyncHandler(async (req, res) => {
    await controller.deleteBadge(req.params.id);
    res.status(204).send();
  })
);
