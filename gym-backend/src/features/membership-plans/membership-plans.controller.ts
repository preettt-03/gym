import { Request, Response } from 'express';
import * as service from '@/features/membership-plans/membership-plans.service';

export async function list(_req: Request, res: Response) {
  res.json({ plans: await service.listActivePlans() });
}

export async function adminList(_req: Request, res: Response) {
  res.json({ plans: await service.listAllPlans() });
}

export async function create(req: Request, res: Response) {
  const plan = await service.createPlan(req.body);
  res.status(201).json({ plan });
}

export async function update(req: Request, res: Response) {
  const plan = await service.updatePlan(req.params.id, req.body);
  res.json({ plan });
}

export async function remove(req: Request, res: Response) {
  await service.deletePlan(req.params.id);
  res.status(204).send();
}
