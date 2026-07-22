import { Response } from 'express';
import { AuthedRequest } from '@/middlewares/auth';
import * as service from '@/features/users/users.service';

export async function me(req: AuthedRequest, res: Response) {
  const user = await service.getProfile(req.user!.id);
  res.json({ user });
}

export async function updateProfile(req: AuthedRequest, res: Response) {
  const user = await service.updateProfile(req.user!.id, req.body);
  res.json({ user });
}

export async function logWeight(req: AuthedRequest, res: Response) {
  const { weightKg, loggedAt } = req.body;
  const log = await service.logWeight(req.user!.id, weightKg, loggedAt);
  res.status(201).json({ log });
}

export async function weightLogs(req: AuthedRequest, res: Response) {
  const logs = await service.listWeightLogs(req.user!.id);
  res.json({ logs });
}

export async function dashboard(req: AuthedRequest, res: Response) {
  const data = await service.getDashboard(req.user!.id);
  res.json(data);
}
