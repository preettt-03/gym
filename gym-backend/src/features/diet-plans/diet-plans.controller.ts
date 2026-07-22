import { Response } from 'express';
import { AuthedRequest } from '@/middlewares/auth';
import * as service from '@/features/diet-plans/diet-plans.service';

// --- Admin ---

export async function adminCreate(req: AuthedRequest, res: Response) {
  const plan = await service.createAdminDietPlan(req.user!.id, req.body);
  res.status(201).json({ plan });
}

export async function adminList(_req: AuthedRequest, res: Response) {
  const plans = await service.listAdminDietPlans();
  res.json({ plans });
}

export async function adminGet(req: AuthedRequest, res: Response) {
  const plan = await service.getAdminDietPlan(req.params.id);
  res.json({ plan });
}

export async function adminUpdate(req: AuthedRequest, res: Response) {
  const plan = await service.updateDietPlanMeta(req.params.id, req.body);
  res.json({ plan });
}

export async function adminRemove(req: AuthedRequest, res: Response) {
  await service.deleteDietPlan(req.params.id);
  res.status(204).send();
}

export async function adminAssign(req: AuthedRequest, res: Response) {
  await service.assignDietPlan(req.params.id, req.body.userIds);
  res.json({ message: 'Diet plan assigned' });
}

export async function adminUnassign(req: AuthedRequest, res: Response) {
  await service.unassignDietPlan(req.params.id, req.params.userId);
  res.json({ message: 'Diet plan unassigned' });
}

// --- User-facing ---

export async function myList(req: AuthedRequest, res: Response) {
  const result = await service.listMyDietPlans(req.user!.id);
  res.json(result);
}

export async function myCreate(req: AuthedRequest, res: Response) {
  const plan = await service.createUserDietPlan(req.user!.id, req.body);
  res.status(201).json({ plan });
}

export async function myGet(req: AuthedRequest, res: Response) {
  const plan = await service.getMyDietPlan(req.params.id, req.user!.id);
  res.json({ plan });
}

export async function myUpdate(req: AuthedRequest, res: Response) {
  const plan = await service.updateMyDietPlan(req.params.id, req.user!.id, req.body);
  res.json({ plan });
}

export async function myRemove(req: AuthedRequest, res: Response) {
  await service.deleteMyDietPlan(req.params.id, req.user!.id);
  res.status(204).send();
}
