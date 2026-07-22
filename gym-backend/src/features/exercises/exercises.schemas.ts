import { z } from 'zod';

const difficultyEnum = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

export const listExercisesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    category: z.string().optional(),
    equipment: z.string().optional(),
    difficulty: difficultyEnum.optional(),
    targetMuscle: z.string().optional(),
    workoutType: z.string().optional(),
    minCalories: z.string().optional(),
    maxCalories: z.string().optional(),
    minDuration: z.string().optional(),
    maxDuration: z.string().optional(),
  }),
});

export const slugParamSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const exerciseBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  videoUrl: z.string().url().optional(),
  gifUrl: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  difficulty: difficultyEnum.default('BEGINNER'),
  targetMuscle: z.string().min(1),
  secondaryMuscles: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  caloriesBurnedEstimate: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  workoutType: z.string().optional(),
  instructions: z.array(z.string()).optional(),
  commonMistakes: z.array(z.string()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

export const createExerciseSchema = z.object({
  body: exerciseBody,
});

export const updateExerciseSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: exerciseBody.partial(),
});

export type CreateExerciseInput = z.infer<typeof exerciseBody>;
export type UpdateExerciseInput = Partial<CreateExerciseInput>;
