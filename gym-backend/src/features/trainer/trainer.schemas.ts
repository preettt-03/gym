import { z } from 'zod';

export const traineeIdParamSchema = z.object({
  params: z.object({ traineeId: z.string().uuid() }),
});

export const assignWorkoutPlanSchema = z.object({
  params: z.object({ traineeId: z.string().uuid() }),
  body: z.object({ planId: z.string().uuid() }),
});

export const assignDietPlanSchema = z.object({
  params: z.object({ traineeId: z.string().uuid() }),
  body: z.object({ planId: z.string().uuid() }),
});

export const sendNoteSchema = z.object({
  params: z.object({ traineeId: z.string().uuid() }),
  body: z.object({
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(1000).optional(),
  }),
});
