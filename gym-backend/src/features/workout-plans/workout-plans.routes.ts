import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/workout-plans/workout-plans.controller';
import * as schemas from '@/features/workout-plans/workout-plans.schemas';

// User-facing: /api/v1/workout-plans
export const workoutPlansRouter = Router();
workoutPlansRouter.use(requireAuth);

workoutPlansRouter.get('/', asyncHandler(controller.myList));
workoutPlansRouter.post('/', validate(schemas.createPlanSchema), asyncHandler(controller.myCreate));
workoutPlansRouter.get('/:id', validate(schemas.idParamSchema), asyncHandler(controller.myGet));
workoutPlansRouter.patch('/:id', validate(schemas.updatePlanSchema), asyncHandler(controller.myUpdate));
workoutPlansRouter.delete('/:id', validate(schemas.idParamSchema), asyncHandler(controller.myRemove));

workoutPlansRouter.post(
  '/exercises/:planExerciseId/swap',
  validate(schemas.swapExerciseSchema),
  asyncHandler(controller.swapExercise)
);
workoutPlansRouter.post(
  '/days/:dayId/complete',
  validate(schemas.completeDaySchema),
  asyncHandler(controller.completeDay)
);

// User-facing: /api/v1/workout-logs
export const workoutLogsRouter = Router();
workoutLogsRouter.use(requireAuth);
workoutLogsRouter.get('/', validate(schemas.listLogsSchema), asyncHandler(controller.listLogs));
workoutLogsRouter.get('/:id', validate(schemas.idParamSchema), asyncHandler(controller.getLog));

// Admin: /api/v1/admin/workout-plans
export const adminWorkoutPlansRouter = Router();
adminWorkoutPlansRouter.use(requireAuth, requireRole(Role.ADMIN));

adminWorkoutPlansRouter.post('/', validate(schemas.createPlanSchema), asyncHandler(controller.adminCreate));
adminWorkoutPlansRouter.get('/', asyncHandler(controller.adminList));
adminWorkoutPlansRouter.get('/:id', validate(schemas.idParamSchema), asyncHandler(controller.adminGet));
adminWorkoutPlansRouter.patch('/:id', validate(schemas.updatePlanSchema), asyncHandler(controller.adminUpdate));
adminWorkoutPlansRouter.delete('/:id', validate(schemas.idParamSchema), asyncHandler(controller.adminRemove));
adminWorkoutPlansRouter.post(
  '/:id/assign',
  validate(schemas.assignPlanSchema),
  asyncHandler(controller.adminAssign)
);
adminWorkoutPlansRouter.delete(
  '/:id/assign/:userId',
  validate(schemas.unassignPlanSchema),
  asyncHandler(controller.adminUnassign)
);
