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
    age: z.number().int().min(1).max(120).optional(),
    gender: genderEnum.optional(),
    heightCm: z.number().min(100, 'Height must be at least 100 cm').max(250, 'Height must be at most 250 cm').optional(),
    weightKg: z.number().min(25, 'Weight must be at least 25 kg').max(300, 'Weight must be at most 300 kg').optional(),
    targetWeightKg: z.number().min(25, 'Target must be at least 25 kg').max(300, 'Target must be at most 300 kg').optional(),
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
    weightKg: z.number().min(25, 'Weight must be at least 25 kg').max(300, 'Weight must be at most 300 kg'),
    loggedAt: z.string().datetime().optional(),
  }),
});
