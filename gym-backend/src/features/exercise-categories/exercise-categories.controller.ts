import { Request, Response } from 'express';
import * as service from '@/features/exercise-categories/exercise-categories.service';

export async function list(_req: Request, res: Response) {
  const categories = await service.listCategories();
  res.json({ categories });
}

export async function create(req: Request, res: Response) {
  const { name, description } = req.body;
  const category = await service.createCategory(name, description);
  res.status(201).json({ category });
}

export async function update(req: Request, res: Response) {
  const category = await service.updateCategory(req.params.id, req.body);
  res.json({ category });
}

export async function remove(req: Request, res: Response) {
  await service.deleteCategory(req.params.id);
  res.status(204).send();
}
