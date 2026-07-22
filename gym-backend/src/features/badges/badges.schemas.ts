import { z } from 'zod';

const badgeBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  iconUrl: z.string().url().optional(),
  streakThresholdDays: z.number().int().positive().optional(),
});

export const createBadgeSchema = z.object({ body: badgeBody });

export const updateBadgeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: badgeBody.partial(),
});

export const badgeIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
