import { Response } from 'express';
import { Difficulty } from '@prisma/client';
import { AuthedRequest } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import * as service from '@/features/exercises/exercises.service';

export async function list(req: AuthedRequest, res: Response) {
  const q = req.query as Record<string, string | undefined>;
  const pagination = parsePagination(req.query as Record<string, unknown>);

  const result = await service.listExercises(
    {
      search: q.search,
      category: q.category,
      equipment: q.equipment,
      difficulty: q.difficulty as Difficulty | undefined,
      targetMuscle: q.targetMuscle,
      workoutType: q.workoutType,
      minCalories: q.minCalories !== undefined ? Number(q.minCalories) : undefined,
      maxCalories: q.maxCalories !== undefined ? Number(q.maxCalories) : undefined,
      minDuration: q.minDuration !== undefined ? Number(q.minDuration) : undefined,
      maxDuration: q.maxDuration !== undefined ? Number(q.maxDuration) : undefined,
    },
    pagination
  );

  res.json(result);
}

export async function detail(req: AuthedRequest, res: Response) {
  const exercise = await service.getExerciseBySlug(req.params.slug, req.user?.id);
  res.json({ exercise });
}

export async function create(req: AuthedRequest, res: Response) {
  const exercise = await service.createExercise(req.body);
  res.status(201).json({ exercise });
}

export async function update(req: AuthedRequest, res: Response) {
  const exercise = await service.updateExercise(req.params.id, req.body);
  res.json({ exercise });
}

export async function remove(req: AuthedRequest, res: Response) {
  await service.deleteExercise(req.params.id);
  res.status(204).send();
}

export async function toggleFavorite(req: AuthedRequest, res: Response) {
  const result = await service.toggleFavorite(req.user!.id, req.params.id);
  res.json(result);
}

export async function favorite(req: AuthedRequest, res: Response) {
  res.json(await service.setFavorite(req.user!.id, req.params.id, true));
}

export async function unfavorite(req: AuthedRequest, res: Response) {
  res.json(await service.setFavorite(req.user!.id, req.params.id, false));
}

export async function clearRecent(req: AuthedRequest, res: Response) {
  await service.clearRecentlyViewed(req.user!.id);
  res.status(204).send();
}

export async function favorites(req: AuthedRequest, res: Response) {
  const items = await service.listFavorites(req.user!.id);
  res.json({ items });
}

export async function recent(req: AuthedRequest, res: Response) {
  const items = await service.listRecentlyViewed(req.user!.id);
  res.json({ items });
}
