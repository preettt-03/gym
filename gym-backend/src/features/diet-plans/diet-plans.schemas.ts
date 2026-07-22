import { z } from 'zod';

const mealTypeEnum = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS', 'PRE_WORKOUT', 'POST_WORKOUT']);

const mealItemSchema = z.object({
  foodId: z.string().uuid(),
  quantityGrams: z.number().positive(),
  notes: z.string().optional(),
});

const mealEntrySchema = z.object({
  mealType: mealTypeEnum,
  title: z.string().optional(),
  items: z.array(mealItemSchema).default([]),
});

const dietPlanBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  estimatedCalories: z.number().int().nonnegative().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  meals: z.array(mealEntrySchema).min(1),
});

export const createDietPlanSchema = z.object({ body: dietPlanBody });

export const updateDietPlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: dietPlanBody.partial(),
});

export const dietPlanIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const assignDietPlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ userIds: z.array(z.string().uuid()).min(1) }),
});

export const unassignDietPlanSchema = z.object({
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
});

export type DietPlanInput = z.infer<typeof dietPlanBody>;
export type DietPlanUpdateInput = Partial<DietPlanInput>;
