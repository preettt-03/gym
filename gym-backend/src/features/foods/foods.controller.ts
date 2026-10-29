import { Request, Response } from 'express';
import { parsePagination } from '@/lib/pagination';
import * as service from '@/features/foods/foods.service';

export async function list(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const { search } = req.query as Record<string, string | undefined>;
  const result = await service.listFoods(search, pagination);
  res.json(result);
}

export async function adminList(req: Request, res: Response) {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const { search } = req.query as Record<string, string | undefined>;
  res.json(await service.listFoods(search, pagination, true));
}

export async function get(req: Request, res: Response) {
  const food = await service.getFood(req.params.id);
  res.json({ food });
}

export async function create(req: Request, res: Response) {
  const food = await service.createFood(req.body);
  res.status(201).json({ food });
}

export async function update(req: Request, res: Response) {
  const food = await service.updateFood(req.params.id, req.body);
  res.json({ food });
}

export async function remove(req: Request, res: Response) {
  await service.deleteFood(req.params.id);
  res.status(204).send();
}
