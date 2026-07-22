import { Response } from 'express';
import { AuthedRequest } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import * as service from '@/features/workout-plans/workout-plans.service';

// --- Admin ---

export async function adminCreate(req: AuthedRequest, res: Response) {
  const plan = await service.createAdminPlan(req.user!.id, req.body);
  res.status(201).json({ plan });
}

export async function adminList(_req: AuthedRequest, res: Response) {
  const plans = await service.listAdminPlans();
  res.json({ plans });
}

export async function adminGet(req: AuthedRequest, res: Response) {
  const plan = await service.getAdminPlan(req.params.id);
  res.json({ plan });
}

export async function adminUpdate(req: AuthedRequest, res: Response) {
  const plan = await service.updatePlanMeta(req.params.id, req.body);
  res.json({ plan });
}

export async function adminRemove(req: AuthedRequest, res: Response) {
  await service.deletePlan(req.params.id);
  res.status(204).send();
}

export async function adminAssign(req: AuthedRequest, res: Response) {
  await service.assignPlan(req.params.id, req.body.userIds);
  res.json({ message: 'Plan assigned' });
}

export async function adminUnassign(req: AuthedRequest, res: Response) {
  await service.unassignPlan(req.params.id, req.params.userId);
  res.json({ message: 'Plan unassigned' });
}

// --- User-facing ---

export async function myList(req: AuthedRequest, res: Response) {
  const result = await service.listMyPlans(req.user!.id);
  res.json(result);
}

export async function myCreate(req: AuthedRequest, res: Response) {
  const plan = await service.createUserPlan(req.user!.id, req.body);
  res.status(201).json({ plan });
}

export async function myGet(req: AuthedRequest, res: Response) {
  const plan = await service.getMyPlan(req.params.id, req.user!.id);
  res.json({ plan });
}

export async function myUpdate(req: AuthedRequest, res: Response) {
  const plan = await service.updateMyPlan(req.params.id, req.user!.id, req.body);
  res.json({ plan });
}

export async function myRemove(req: AuthedRequest, res: Response) {
  await service.deleteMyPlan(req.params.id, req.user!.id);
  res.status(204).send();
}

export async function swapExercise(req: AuthedRequest, res: Response) {
  const override = await service.swapExercise(
    req.user!.id,
    req.params.planExerciseId,
    req.body.replacementExerciseId
  );
  res.json({ override });
}

export async function completeDay(req: AuthedRequest, res: Response) {
  const log = await service.completeDay(req.user!.id, req.params.dayId, req.body.notes, req.body.exerciseLogs);
  res.json({ log });
}

export async function listLogs(req: AuthedRequest, res: Response) {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const { from, to } = req.query as Record<string, string | undefined>;
  const result = await service.listMyWorkoutLogs(req.user!.id, pagination, from, to);
  res.json(result);
}

export async function getLog(req: AuthedRequest, res: Response) {
  const log = await service.getWorkoutLog(req.user!.id, req.params.id);
  res.json({ log });
}
