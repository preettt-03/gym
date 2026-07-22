import { z } from 'zod';

export const listFoodsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const foodIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const foodBody = z.object({
  name: z.string().min(1),
  caloriesPer100g: z.number().nonnegative(),
  proteinPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  fiberPer100g: z.number().nonnegative().optional(),
  sugarPer100g: z.number().nonnegative().optional(),
  sodiumMgPer100g: z.number().nonnegative().optional(),
});

export const createFoodSchema = z.object({ body: foodBody });

export const updateFoodSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: foodBody.partial(),
});
