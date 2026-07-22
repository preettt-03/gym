import { z } from 'zod';

export const createDietCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }),
});

export const updateDietCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  }),
});

export const dietCategoryIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
