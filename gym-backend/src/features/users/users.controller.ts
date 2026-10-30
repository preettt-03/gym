import { Response } from 'express';
import { AuthedRequest } from '@/middlewares/auth';
import { AppError } from '@/middlewares/errorHandler';
import * as service from '@/features/users/users.service';
import * as contact from '@/features/auth/phone-auth.service';

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

export async function uploadPhoto(req: AuthedRequest, res: Response) {
  if (!req.file) throw new AppError('Choose a photo to upload', 400);
  const user = await service.setProfilePhoto(req.user!.id, req.file.filename);
  res.json({ user });
}

export async function removePhoto(req: AuthedRequest, res: Response) {
  const user = await service.removeProfilePhoto(req.user!.id);
  res.json({ user });
}

export async function sendPhoneOtp(req: AuthedRequest, res: Response) {
  res.json(await contact.sendAddPhoneOtp(req.user!.id, req.body.phone));
}

export async function verifyPhone(req: AuthedRequest, res: Response) {
  await contact.verifyAddPhone(req.user!.id, req.body.phone, req.body.code);
  res.json({ user: await service.getProfile(req.user!.id) });
}

export async function removePhone(req: AuthedRequest, res: Response) {
  await contact.removePhone(req.user!.id);
  res.json({ user: await service.getProfile(req.user!.id) });
}

export async function sendEmailOtp(req: AuthedRequest, res: Response) {
  res.json(await contact.sendChangeEmailOtp(req.user!.id, req.body.email));
}

export async function verifyEmailChange(req: AuthedRequest, res: Response) {
  await contact.verifyChangeEmail(req.user!.id, req.body.email, req.body.code);
  res.json({ user: await service.getProfile(req.user!.id) });
}
