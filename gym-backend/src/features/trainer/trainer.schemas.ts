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

const noteBody = z.string().trim().min(1, 'Note cannot be empty').max(2000, 'Note is too long');

export const createPrivateNoteSchema = z.object({
  params: z.object({ traineeId: z.string().uuid() }),
  body: z.object({ body: noteBody }),
});

export const updatePrivateNoteSchema = z.object({
  params: z.object({ noteId: z.string().uuid() }),
  body: z.object({ body: noteBody }),
});

export const privateNoteIdSchema = z.object({
  params: z.object({ noteId: z.string().uuid() }),
});
