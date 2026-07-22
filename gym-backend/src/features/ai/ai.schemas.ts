import { z } from 'zod';

export const generateWorkoutPlanSchema = z.object({
  body: z.object({
    goal: z.string().optional(),
    daysPerWeek: z.number().int().min(1).max(7).default(3),
    focusAreas: z.array(z.string()).optional(),
    save: z.boolean().default(false),
  }),
});

export const generateDietPlanSchema = z.object({
  body: z.object({
    goal: z.string().optional(),
    mealsPerDay: z.number().int().min(1).max(6).default(3),
    dietaryPreferences: z.array(z.string()).optional(),
    save: z.boolean().default(false),
  }),
});

export const formTipSchema = z.object({
  body: z.object({
    exerciseId: z.string().uuid(),
  }),
});

export const chatSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(2000),
  }),
});

export const updateAiSettingsSchema = z.object({
  body: z.object({
    workoutPlanEnabled: z.boolean().optional(),
    dietPlanEnabled: z.boolean().optional(),
    formTipEnabled: z.boolean().optional(),
    motivationEnabled: z.boolean().optional(),
    nutritionSuggestionEnabled: z.boolean().optional(),
    chatbotEnabled: z.boolean().optional(),
    prompts: z.record(z.string()).optional(),
  }),
});

export const listAiLogsSchema = z.object({
  query: z.object({
    feature: z
      .enum(['WORKOUT_PLAN', 'DIET_PLAN', 'FORM_TIP', 'MOTIVATION', 'NUTRITION_SUGGESTION', 'CHATBOT'])
      .optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
