import { z } from 'zod';

export const createProgressPhotoSchema = z.object({
  body: z.object({
    // Upload the file via POST /api/v1/uploads first, then pass its returned url here.
    photoUrl: z.string().url(),
    notes: z.string().trim().max(200).optional(),
    takenAt: z.string().datetime().optional(),
  }),
});

export const progressPhotoIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
