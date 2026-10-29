import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/foods/foods.controller';
import * as schemas from '@/features/foods/foods.schemas';

export const foodsRouter = Router();
foodsRouter.get('/', validate(schemas.listFoodsSchema), asyncHandler(controller.list));
foodsRouter.get('/:id', validate(schemas.foodIdParamSchema), asyncHandler(controller.get));

export const adminFoodsRouter = Router();
adminFoodsRouter.use(requireAuth, requireRole(Role.ADMIN));
adminFoodsRouter.get('/', validate(schemas.listFoodsSchema), asyncHandler(controller.adminList));
adminFoodsRouter.post('/', validate(schemas.createFoodSchema), asyncHandler(controller.create));
adminFoodsRouter.patch('/:id', validate(schemas.updateFoodSchema), asyncHandler(controller.update));
adminFoodsRouter.delete('/:id', validate(schemas.foodIdParamSchema), asyncHandler(controller.remove));
