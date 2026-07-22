import { z } from 'zod';

const conditionTypeEnum = z.enum([
  'COMPLETE_WORKOUT',
  'DRINK_WATER',
  'BURN_CALORIES',
  'HIT_PROTEIN_GOAL',
  'WALK_STEPS',
  'CUSTOM',
]);

const missionBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  conditionType: conditionTypeEnum,
  targetValue: z.number().positive(),
  rewardCoins: z.number().int().nonnegative().default(0),
  rewardXp: z.number().int().nonnegative().default(0),
  rewardBadgeId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const createMissionSchema = z.object({ body: missionBody });

export const updateMissionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: missionBody.partial(),
});

export const missionIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const reportProgressSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ value: z.number().positive() }),
});

export type MissionInput = z.infer<typeof missionBody>;
export type MissionUpdateInput = Partial<MissionInput>;
