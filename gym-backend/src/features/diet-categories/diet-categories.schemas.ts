import { z } from 'zod';

export const createDietCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(60, 'Name is too long'),
    description: z.string().trim().max(300, 'Description is too long').optional(),
  }),
});

export const updateDietCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(60, 'Name is too long').optional(),
    // null clears the description
    description: z.string().trim().max(300, 'Description is too long').nullable().optional(),
  }),
});

export const dietCategoryIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
