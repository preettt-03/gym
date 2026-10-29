import { z } from 'zod';

// Sent as multipart/form-data alongside the `photo` file, so every field arrives as a string.
export const createProgressPhotoSchema = z.object({
  body: z.object({
    notes: z.string().trim().max(200).optional(),
    takenAt: z.string().datetime().optional(),
  }),
});

export const progressPhotoIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
