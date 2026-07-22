import { z } from 'zod';

const mealTypeEnum = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS', 'PRE_WORKOUT', 'POST_WORKOUT']);

export const logFoodSchema = z.object({
  body: z.object({
    foodId: z.string().uuid(),
    quantityGrams: z.number().positive(),
    mealType: mealTypeEnum.optional(),
    loggedAt: z.string().datetime().optional(),
  }),
});

export const listDailyLogsSchema = z.object({
  query: z.object({
    date: z.string().optional(), // YYYY-MM-DD, defaults to today
  }),
});

export const logIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
