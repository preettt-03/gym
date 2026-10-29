import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/diet-categories/diet-categories.controller';
import * as schemas from '@/features/diet-categories/diet-categories.schemas';

export const dietCategoriesRouter = Router();
dietCategoriesRouter.get('/', asyncHandler(controller.list));

export const adminDietCategoriesRouter = Router();
adminDietCategoriesRouter.use(requireAuth, requireRole(Role.ADMIN));
adminDietCategoriesRouter.get('/', asyncHandler(controller.adminList));
adminDietCategoriesRouter.post('/', validate(schemas.createDietCategorySchema), asyncHandler(controller.create));
adminDietCategoriesRouter.patch(
  '/:id',
  validate(schemas.updateDietCategorySchema),
  asyncHandler(controller.update)
);
adminDietCategoriesRouter.delete(
  '/:id',
  validate(schemas.dietCategoryIdParamSchema),
  asyncHandler(controller.remove)
);
