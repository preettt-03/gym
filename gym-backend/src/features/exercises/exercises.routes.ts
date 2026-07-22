import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { optionalAuth, requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/exercises/exercises.controller';
import * as schemas from '@/features/exercises/exercises.schemas';

export const exercisesRouter = Router();

// Public browsing — no login required
exercisesRouter.get('/', validate(schemas.listExercisesSchema), asyncHandler(controller.list));

// Authenticated user actions (must precede the /:slug catch-all)
exercisesRouter.get('/favorites', requireAuth, asyncHandler(controller.favorites));
exercisesRouter.get('/recent', requireAuth, asyncHandler(controller.recent));
exercisesRouter.post(
  '/:id/favorite',
  requireAuth,
  validate(schemas.idParamSchema),
  asyncHandler(controller.toggleFavorite)
);

// Public detail — tracks a view when the caller happens to be logged in
exercisesRouter.get('/:slug', optionalAuth, validate(schemas.slugParamSchema), asyncHandler(controller.detail));

export const adminExercisesRouter = Router();
adminExercisesRouter.use(requireAuth, requireRole(Role.ADMIN));
adminExercisesRouter.post('/', validate(schemas.createExerciseSchema), asyncHandler(controller.create));
adminExercisesRouter.patch('/:id', validate(schemas.updateExerciseSchema), asyncHandler(controller.update));
adminExercisesRouter.delete('/:id', validate(schemas.idParamSchema), asyncHandler(controller.remove));
