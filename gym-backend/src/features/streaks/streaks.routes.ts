import { Response, Router } from 'express';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { AuthedRequest, requireAuth } from '@/middlewares/auth';
import * as service from '@/features/streaks/streaks.service';

export const streaksRouter = Router();
streaksRouter.use(requireAuth);

streaksRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ streak: await service.getMyStreak(req.user!.id) });
  })
);
