import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/membership-plans/membership-plans.controller';
import * as schemas from '@/features/membership-plans/membership-plans.schemas';

export const membershipPlansRouter = Router();
membershipPlansRouter.get('/', asyncHandler(controller.list));

export const adminMembershipPlansRouter = Router();
adminMembershipPlansRouter.use(requireAuth, requireRole(Role.ADMIN));
adminMembershipPlansRouter.get('/', asyncHandler(controller.adminList));
adminMembershipPlansRouter.post('/', validate(schemas.createPlanSchema), asyncHandler(controller.create));
adminMembershipPlansRouter.patch('/:id', validate(schemas.updatePlanSchema), asyncHandler(controller.update));
adminMembershipPlansRouter.delete('/:id', validate(schemas.planIdParamSchema), asyncHandler(controller.remove));
