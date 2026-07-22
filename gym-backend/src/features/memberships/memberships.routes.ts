import { Response, Router } from 'express';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth } from '@/middlewares/auth';
import { checkoutSchema } from '@/features/memberships/memberships.schemas';
import * as service from '@/features/memberships/memberships.service';

export const membershipsRouter = Router();
membershipsRouter.use(requireAuth);

membershipsRouter.post(
  '/checkout',
  validate(checkoutSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { planId, gateway } = req.body;
    const result = await service.checkout(req.user!.id, planId, gateway);
    res.status(201).json(result);
  })
);

membershipsRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await service.getMyMembershipStatus(req.user!.id));
  })
);
