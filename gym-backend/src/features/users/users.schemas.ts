import { z } from 'zod';

const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER']);
const fitnessGoalEnum = z.enum(['WEIGHT_LOSS', 'MUSCLE_GAIN', 'MAINTENANCE', 'ENDURANCE', 'GENERAL_FITNESS']);
const experienceLevelEnum = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
const activityLevelEnum = z.enum([
  'SEDENTARY',
  'LIGHTLY_ACTIVE',
  'MODERATELY_ACTIVE',
  'VERY_ACTIVE',
  'EXTRA_ACTIVE',
]);

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    photoUrl: z.string().url().optional(),
    age: z.number().int().min(1).max(120).optional(),
    gender: genderEnum.optional(),
    heightCm: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    targetWeightKg: z.number().positive().optional(),
    fitnessGoal: fitnessGoalEnum.optional(),
    experienceLevel: experienceLevelEnum.optional(),
    activityLevel: activityLevelEnum.optional(),
    gymName: z.string().optional(),
    gymBranch: z.string().optional(),
    medicalConditions: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
  }),
});

export const logWeightSchema = z.object({
  body: z.object({
    weightKg: z.number().positive(),
    loggedAt: z.string().datetime().optional(),
  }),
});
