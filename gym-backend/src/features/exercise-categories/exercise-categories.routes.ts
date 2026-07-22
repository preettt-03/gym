import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/exercise-categories/exercise-categories.controller';
import * as schemas from '@/features/exercise-categories/exercise-categories.schemas';

export const exerciseCategoriesRouter = Router();
exerciseCategoriesRouter.get('/', asyncHandler(controller.list));

export const adminExerciseCategoriesRouter = Router();
adminExerciseCategoriesRouter.use(requireAuth, requireRole(Role.ADMIN));
adminExerciseCategoriesRouter.post('/', validate(schemas.createCategorySchema), asyncHandler(controller.create));
adminExerciseCategoriesRouter.patch(
  '/:id',
  validate(schemas.updateCategorySchema),
  asyncHandler(controller.update)
);
adminExerciseCategoriesRouter.delete(
  '/:id',
  validate(schemas.categoryIdParamSchema),
  asyncHandler(controller.remove)
);
