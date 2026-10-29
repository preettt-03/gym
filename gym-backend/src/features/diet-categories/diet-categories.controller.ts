import { Request, Response } from 'express';
import * as service from '@/features/diet-categories/diet-categories.service';

export async function list(_req: Request, res: Response) {
  const categories = await service.listDietCategories();
  res.json({ categories });
}

export async function adminList(_req: Request, res: Response) {
  const categories = await service.listDietCategories(true);
  res.json({ categories });
}

export async function create(req: Request, res: Response) {
  const { name, description } = req.body;
  const category = await service.createDietCategory(name, description);
  res.status(201).json({ category });
}

export async function update(req: Request, res: Response) {
  const category = await service.updateDietCategory(req.params.id, req.body);
  res.json({ category });
}

export async function remove(req: Request, res: Response) {
  await service.deleteDietCategory(req.params.id);
  res.status(204).send();
}
