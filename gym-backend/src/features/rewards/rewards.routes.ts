import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import * as service from '@/features/rewards/rewards.service';
import * as schemas from '@/features/rewards/rewards.schemas';

// Member-facing: /api/v1/rewards
export const rewardsRouter = Router();
rewardsRouter.use(requireAuth);

rewardsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await service.getStore(req.user!.id));
  })
);

rewardsRouter.get(
  '/redemptions',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ redemptions: await service.listMyRedemptions(req.user!.id) });
  })
);

rewardsRouter.post(
  '/:id/redeem',
  validate(schemas.idParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json({ redemption: await service.redeem(req.user!.id, req.params.id) });
  })
);

rewardsRouter.post(
  '/redemptions/:id/cancel',
  validate(schemas.idParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.cancelMyRedemption(req.user!.id, req.params.id);
    res.json({ cancelled: true });
  })
);

// Admin: /api/v1/admin/rewards
export const adminRewardsRouter = Router();
adminRewardsRouter.use(requireAuth, requireRole(Role.ADMIN));

adminRewardsRouter.get(
  '/items',
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ items: await service.listItems() });
  })
);

adminRewardsRouter.post(
  '/items',
  validate(schemas.createItemSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json({ item: await service.createItem(req.body) });
  })
);

adminRewardsRouter.patch(
  '/items/:id',
  validate(schemas.updateItemSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ item: await service.updateItem(req.params.id, req.body) });
  })
);

adminRewardsRouter.delete(
  '/items/:id',
  validate(schemas.idParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await service.deleteItem(req.params.id));
  })
);

adminRewardsRouter.get(
  '/redemptions',
  validate(schemas.redemptionsQuerySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await service.listRedemptions(schemas.redemptionsQuery.parse(req.query)));
  })
);

adminRewardsRouter.post(
  '/redemptions/:id/fulfill',
  validate(schemas.noteSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.fulfillRedemption(req.user!.id, req.params.id, req.body.note);
    res.json({ fulfilled: true });
  })
);

adminRewardsRouter.post(
  '/redemptions/:id/cancel',
  validate(schemas.noteSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.adminCancelRedemption(req.params.id, req.body.note);
    res.json({ cancelled: true });
  })
);
