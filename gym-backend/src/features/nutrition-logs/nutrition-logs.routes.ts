import { Response, Router } from 'express';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth } from '@/middlewares/auth';
import * as schemas from '@/features/nutrition-logs/nutrition-logs.schemas';
import * as service from '@/features/nutrition-logs/nutrition-logs.service';

export const nutritionLogsRouter = Router();
nutritionLogsRouter.use(requireAuth);

nutritionLogsRouter.post(
  '/',
  validate(schemas.logFoodSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { foodId, quantityGrams, mealType, loggedAt } = req.body;
    const log = await service.logFood(req.user!.id, foodId, quantityGrams, mealType, loggedAt);
    res.status(201).json({ log });
  })
);

nutritionLogsRouter.get(
  '/',
  validate(schemas.listDailyLogsSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { date } = req.query as Record<string, string | undefined>;
    const result = await service.listDailyLogs(req.user!.id, date);
    res.json(result);
  })
);

nutritionLogsRouter.delete(
  '/:id',
  validate(schemas.logIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.deleteLog(req.user!.id, req.params.id);
    res.status(204).send();
  })
);
