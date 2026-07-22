import { Router } from 'express';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth } from '@/middlewares/auth';
import * as controller from '@/features/users/users.controller';
import * as schemas from '@/features/users/users.schemas';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', asyncHandler(controller.me));
usersRouter.patch('/me/profile', validate(schemas.updateProfileSchema), asyncHandler(controller.updateProfile));
usersRouter.get('/me/dashboard', asyncHandler(controller.dashboard));
usersRouter.post('/me/weight-logs', validate(schemas.logWeightSchema), asyncHandler(controller.logWeight));
usersRouter.get('/me/weight-logs', asyncHandler(controller.weightLogs));
