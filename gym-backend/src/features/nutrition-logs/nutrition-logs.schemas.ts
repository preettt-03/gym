import { z } from 'zod';

const mealTypeEnum = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS', 'PRE_WORKOUT', 'POST_WORKOUT']);

export const logFoodSchema = z.object({
  body: z.object({
    foodId: z.string().uuid(),
    quantityGrams: z.number().positive().max(5000, 'Quantity must be 5,000 g or less'),
    mealType: mealTypeEnum.optional(),
    // Lets members back-fill a past day; future timestamps are rejected.
    loggedAt: z
      .string()
      .datetime()
      .refine((v) => new Date(v).getTime() <= Date.now() + 60_000, 'Can\'t log food in the future')
      .optional(),
  }),
});

export const listDailyLogsSchema = z.object({
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(), // IST day, defaults to today
  }),
});

export const logIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
