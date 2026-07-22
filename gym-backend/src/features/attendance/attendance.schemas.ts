import { z } from 'zod';

export const adminCheckInSchema = z.object({
  body: z.object({ userId: z.string().uuid() }),
});

export const listAttendanceSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
