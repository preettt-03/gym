import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/diet-plans/diet-plans.controller';
import * as schemas from '@/features/diet-plans/diet-plans.schemas';

// User-facing: /api/v1/diet-plans
export const dietPlansRouter = Router();
dietPlansRouter.use(requireAuth);

dietPlansRouter.get('/', asyncHandler(controller.myList));
dietPlansRouter.post('/', validate(schemas.createDietPlanSchema), asyncHandler(controller.myCreate));
dietPlansRouter.get('/:id', validate(schemas.dietPlanIdParamSchema), asyncHandler(controller.myGet));
dietPlansRouter.patch('/:id', validate(schemas.updateDietPlanSchema), asyncHandler(controller.myUpdate));
dietPlansRouter.delete('/:id', validate(schemas.dietPlanIdParamSchema), asyncHandler(controller.myRemove));

// Admin: /api/v1/admin/diet-plans
export const adminDietPlansRouter = Router();
adminDietPlansRouter.use(requireAuth, requireRole(Role.ADMIN));

adminDietPlansRouter.post('/', validate(schemas.createDietPlanSchema), asyncHandler(controller.adminCreate));
adminDietPlansRouter.get('/', asyncHandler(controller.adminList));
adminDietPlansRouter.get('/:id', validate(schemas.dietPlanIdParamSchema), asyncHandler(controller.adminGet));
adminDietPlansRouter.patch('/:id', validate(schemas.updateDietPlanSchema), asyncHandler(controller.adminUpdate));
adminDietPlansRouter.delete('/:id', validate(schemas.dietPlanIdParamSchema), asyncHandler(controller.adminRemove));
adminDietPlansRouter.post(
  '/:id/assign',
  validate(schemas.assignDietPlanSchema),
  asyncHandler(controller.adminAssign)
);
adminDietPlansRouter.delete(
  '/:id/assign/:userId',
  validate(schemas.unassignDietPlanSchema),
  asyncHandler(controller.adminUnassign)
);
