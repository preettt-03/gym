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

// Values are per 100 g, so no single macro can exceed 100 g and energy tops
// out around pure fat (~900 kcal).
const grams = z.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100 g per 100 g');

const foodFields = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  caloriesPer100g: z.number().min(0, 'Cannot be negative').max(900, 'Cannot exceed 900 kcal per 100 g'),
  proteinPer100g: grams,
  carbsPer100g: grams,
  fatPer100g: grams,
  // Optional extras; null clears a stored value.
  fiberPer100g: grams.nullable().optional(),
  sugarPer100g: grams.nullable().optional(),
  sodiumMgPer100g: z.number().min(0, 'Cannot be negative').max(50_000, 'Cannot exceed 50,000 mg per 100 g').nullable().optional(),
});

export const MACROS_TOO_HIGH = 'Protein, carbs and fat together cannot exceed 100 g per 100 g';

export function macrosFit(food: { proteinPer100g: number; carbsPer100g: number; fatPer100g: number }) {
  return food.proteinPer100g + food.carbsPer100g + food.fatPer100g <= 100;
}

export const createFoodSchema = z.object({
  body: foodFields.refine(macrosFit, { message: MACROS_TOO_HIGH, path: ['proteinPer100g'] }),
});

export const updateFoodSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: foodFields.partial(),
});
