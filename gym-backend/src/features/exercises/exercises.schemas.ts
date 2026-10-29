import { z } from 'zod';
import { MUSCLE_GROUP_KEYS } from '@/lib/muscles';

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
    muscleGroup: z.enum(MUSCLE_GROUP_KEYS).optional(),
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

const url = z.string().trim().url('Enter a valid URL').max(1000);
// Blank entries (an empty step row left in the form) are dropped rather than rejected.
const textList = (max: number, itemMax: number) =>
  z
    .array(z.string().trim().max(itemMax, `Keep each entry under ${itemMax} characters`))
    .max(max, `At most ${max} entries`)
    .transform((list) => list.filter(Boolean));
// Optional text that an edit can clear by sending null.
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v === '' ? null : v));

const exerciseBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: optionalText(2000),
  videoUrl: url.nullable().optional(),
  gifUrl: url.nullable().optional(),
  thumbnailUrl: url.nullable().optional(),
  images: z.array(url).max(12, 'At most 12 gallery images').optional(),
  difficulty: difficultyEnum.default('BEGINNER'),
  targetMuscle: z.string().trim().min(1, 'Primary muscle is required').max(60),
  secondaryMuscles: textList(10, 60).optional(),
  equipment: textList(10, 60).optional(),
  caloriesBurnedEstimate: z.number().int().min(0).max(5000).nullable().optional(),
  durationMinutes: z.number().int().min(0).max(600).nullable().optional(),
  workoutType: optionalText(60),
  instructions: textList(20, 500).optional(),
  commonMistakes: textList(20, 300).optional(),
  coachTip: optionalText(1000),
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
