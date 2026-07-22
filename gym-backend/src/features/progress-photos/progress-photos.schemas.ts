import { z } from 'zod';

export const createProgressPhotoSchema = z.object({
  body: z.object({
    // Upload the file via POST /api/v1/uploads first, then pass its returned url here.
    photoUrl: z.string().url(),
    notes: z.string().optional(),
    takenAt: z.string().datetime().optional(),
  }),
});
