import { z } from 'zod';

const rulesSchema = z.object({
  fitnessGoal: z.enum(['WEIGHT_LOSS', 'MUSCLE_GAIN', 'MAINTENANCE', 'ENDURANCE', 'GENERAL_FITNESS']).optional(),
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  ageMin: z.number().int().positive().optional(),
  ageMax: z.number().int().positive().optional(),
  bmiMin: z.number().positive().optional(),
  bmiMax: z.number().positive().optional(),
  membershipStatus: z.enum(['ACTIVE', 'EXPIRED', 'NONE']).optional(),
  inactiveDays: z.number().int().positive().optional(),
});

export const createSegmentSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    rules: rulesSchema,
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const assignPlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ planId: z.string().uuid() }),
});

export const notifySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ title: z.string().min(1), body: z.string().optional() }),
});

export type SegmentRules = z.infer<typeof rulesSchema>;
