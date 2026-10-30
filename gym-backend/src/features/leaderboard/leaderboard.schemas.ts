import { z } from 'zod';
import { SEGMENTS } from '@/features/leaderboard/leaderboard.service';

export const periodEnum = z.enum(['daily', 'weekly', 'monthly', 'all-time']);

export const boardQuery = z.object({
  period: periodEnum.default('weekly'),
  // How many periods back (admin only): 1 = yesterday / last week / last month.
  offset: z.coerce.number().int().min(0).max(120).default(0),
  segment: z.enum(SEGMENTS).default('all'),
});

export const exportQuery = boardQuery.extend({ format: z.enum(['csv', 'xlsx']).default('csv') });

export const boardQuerySchema = z.object({ query: boardQuery });
export const exportQuerySchema = z.object({ query: exportQuery });

const weight = z.number().int().min(0).max(1000);
const prize = z.number().int().min(0).max(100000);
const rewardTier = z.object({ enabled: z.boolean(), coins: z.tuple([prize, prize, prize]), xp: z.tuple([prize, prize, prize]) });

export const updateSettingsSchema = z.object({
  body: z
    .object({
      isEnabled: z.boolean(),
      workoutPoints: weight,
      visitPoints: weight,
      caloriesPerPoint: z.number().int().min(1).max(1000),
      gymMinutePoints: weight,
      workoutMinutePoints: weight,
      streakPoints: weight,
      fraudDetection: z.boolean(),
      maxWorkoutsPerDay: z.number().int().min(1).max(50),
      maxCaloriesPerDay: z.number().int().min(100).max(50000),
      maxGymMinutesPerVisit: z.number().int().min(30).max(1440),
      autoFreeze: z.boolean(),
      overtakeAlerts: z.boolean(),
      weeklyWrapUp: z.boolean(),
      rewards: z.object({ daily: rewardTier, weekly: rewardTier, monthly: rewardTier }),
    })
    .partial(),
});

export const adjustmentSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    points: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine((n) => n !== 0, 'Points cannot be zero'),
    reason: z.string().trim().min(3).max(200),
  }),
});

export const userIdParamSchema = z.object({ params: z.object({ userId: z.string().uuid() }) });
export const adjustmentIdParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const visibilitySchema = z.object({
  params: z.object({ userId: z.string().uuid() }),
  body: z.object({ hidden: z.boolean(), reason: z.string().trim().max(200).optional() }),
});

export const highFiveSchema = z.object({
  body: z.object({ toUserId: z.string().uuid(), period: periodEnum.default('weekly') }),
});

export const awardIdParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const displayKeySchema = z.object({ body: z.object({ enabled: z.boolean() }) });

export const displayQuerySchema = z.object({ query: z.object({ key: z.string().min(10).max(100) }) });

export const snapshotsQuerySchema = z.object({
  query: z.object({ period: z.enum(['daily', 'weekly', 'monthly']).optional() }),
});

export const hallOfFameQuery = z.object({ period: z.enum(['daily', 'weekly', 'monthly']).default('weekly') });
export const hallOfFameQuerySchema = z.object({ query: hallOfFameQuery });
