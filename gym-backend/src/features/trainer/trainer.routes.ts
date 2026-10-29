import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import * as schemas from '@/features/trainer/trainer.schemas';
import * as service from '@/features/trainer/trainer.service';
import { listAdminPlans } from '@/features/workout-plans/workout-plans.service';
import { listAdminDietPlans } from '@/features/diet-plans/diet-plans.service';

export const trainerRouter = Router();
trainerRouter.use(requireAuth, requireRole(Role.TRAINER, Role.ADMIN));

trainerRouter.get(
  '/trainees',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ trainees: await service.listTrainees(req.user!.id) });
  })
);

trainerRouter.get(
  '/trainees/:traineeId',
  validate(schemas.traineeIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const profile = await service.getTraineeProfile(req.user!.id, req.params.traineeId);
    res.json({ profile });
  })
);

trainerRouter.get(
  '/trainees/:traineeId/overview',
  validate(schemas.traineeIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await service.getTraineeOverview(req.user!.id, req.params.traineeId));
  })
);

trainerRouter.get(
  '/trainees/:traineeId/workout-logs',
  validate(schemas.traineeIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const logs = await service.listTraineeWorkoutLogs(req.user!.id, req.params.traineeId);
    res.json({ logs });
  })
);

trainerRouter.get(
  '/trainees/:traineeId/weight-logs',
  validate(schemas.traineeIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const logs = await service.listTraineeWeightLogs(req.user!.id, req.params.traineeId);
    res.json({ logs });
  })
);

trainerRouter.get(
  '/trainees/:traineeId/attendance',
  validate(schemas.traineeIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const attendance = await service.listTraineeAttendance(req.user!.id, req.params.traineeId);
    res.json({ attendance });
  })
);

trainerRouter.post(
  '/trainees/:traineeId/assign-workout-plan',
  validate(schemas.assignWorkoutPlanSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.assignWorkoutPlanToTrainee(req.user!.id, req.params.traineeId, req.body.planId);
    res.status(204).send();
  })
);

trainerRouter.post(
  '/trainees/:traineeId/assign-diet-plan',
  validate(schemas.assignDietPlanSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.assignDietPlanToTrainee(req.user!.id, req.params.traineeId, req.body.planId);
    res.status(204).send();
  })
);

trainerRouter.post(
  '/trainees/:traineeId/notes',
  validate(schemas.sendNoteSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const notification = await service.sendNoteToTrainee(
      req.user!.id,
      req.params.traineeId,
      req.body.title,
      req.body.body
    );
    res.status(201).json({ notification });
  })
);

trainerRouter.get(
  '/trainees/:traineeId/private-notes',
  validate(schemas.traineeIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ notes: await service.listPrivateNotes(req.user!.id, req.params.traineeId) });
  })
);

trainerRouter.post(
  '/trainees/:traineeId/private-notes',
  validate(schemas.createPrivateNoteSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json({ note: await service.addPrivateNote(req.user!.id, req.params.traineeId, req.body.body.trim()) });
  })
);

trainerRouter.patch(
  '/private-notes/:noteId',
  validate(schemas.updatePrivateNoteSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ note: await service.updatePrivateNote(req.user!.id, req.params.noteId, req.body.body.trim()) });
  })
);

trainerRouter.delete(
  '/private-notes/:noteId',
  validate(schemas.privateNoteIdSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.deletePrivateNote(req.user!.id, req.params.noteId);
    res.status(204).send();
  })
);

// Read-only catalog access so a trainer can pick a plan to assign — reuses
// the admin plan-listing services (they only ever return ADMIN-source plans,
// with no role check baked in; the role check for this route is above).
trainerRouter.get(
  '/workout-plans',
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ plans: await listAdminPlans() });
  })
);

trainerRouter.get(
  '/diet-plans',
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ plans: await listAdminDietPlans() });
  })
);
