import { z } from 'zod';

const difficultyEnum = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

const exerciseEntrySchema = z.object({
  exerciseId: z.string().uuid(),
  order: z.number().int().nonnegative().optional(),
  targetSets: z.number().int().positive().optional(),
  targetReps: z.number().int().positive().optional(),
  targetWeightKg: z.number().positive().optional(),
  targetDurationSeconds: z.number().int().positive().optional(),
  targetDistanceMeters: z.number().positive().optional(),
  notes: z.string().optional(),
});

const dayEntrySchema = z.object({
  weekNumber: z.number().int().positive().default(1),
  dayNumber: z.number().int().positive(),
  title: z.string().optional(),
  isRestDay: z.boolean().default(false),
  exercises: z.array(exerciseEntrySchema).default([]),
});

const planBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  difficulty: difficultyEnum.default('BEGINNER'),
  estimatedCalories: z.number().int().nonnegative().optional(),
  estimatedMinutes: z.number().int().nonnegative().optional(),
  days: z.array(dayEntrySchema).min(1),
});

export const createPlanSchema = z.object({ body: planBody });

export const updatePlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: planBody.partial(),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const assignPlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ userIds: z.array(z.string().uuid()).min(1) }),
});

export const unassignPlanSchema = z.object({
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
});

export const swapExerciseSchema = z.object({
  params: z.object({ planExerciseId: z.string().uuid() }),
  body: z.object({ replacementExerciseId: z.string().uuid() }),
});

export const completeDaySchema = z.object({
  params: z.object({ dayId: z.string().uuid() }),
  body: z.object({
    notes: z.string().optional(),
    exerciseLogs: z
      .array(
        z.object({
          planExerciseId: z.string().uuid().optional(),
          exerciseId: z.string().uuid(),
          setNumber: z.number().int().positive().default(1),
          reps: z.number().int().nonnegative().optional(),
          weightKg: z.number().nonnegative().optional(),
          durationSeconds: z.number().int().nonnegative().optional(),
          distanceMeters: z.number().nonnegative().optional(),
          caloriesBurned: z.number().int().nonnegative().optional(),
        })
      )
      .default([]),
  }),
});

export const listLogsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export type PlanInput = z.infer<typeof planBody>;
export type PlanUpdateInput = Partial<PlanInput>;
export type ExerciseLogEntry = z.infer<typeof completeDaySchema>['body']['exerciseLogs'][number];
