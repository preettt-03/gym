import { AiFeature } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/middlewares/errorHandler';
import { generateWithGemini, isGeminiConfigured, parseJsonResponse } from '@/lib/gemini';
import { calculateBmi, calculateBmr, calculateCalorieNeeds } from '@/lib/health-calculators';
import { createUserPlan } from '@/features/workout-plans/workout-plans.service';
import { createUserDietPlan } from '@/features/diet-plans/diet-plans.service';

const DEFAULT_PROMPTS: Record<AiFeature, string> = {
  WORKOUT_PLAN:
    'You are an expert certified personal trainer. Design a safe, effective workout plan using ONLY the exercises provided. Tailor volume and intensity to the user profile and stated goal.',
  DIET_PLAN:
    'You are a registered dietitian. Design a balanced meal plan using ONLY the foods provided, hitting the calorie target as closely as possible.',
  FORM_TIP:
    'You are a certified personal trainer. Give concise, safety-focused form cues for the requested exercise.',
  MOTIVATION:
    'You are an upbeat, encouraging fitness coach. Write a short, personalized motivational message for the user based on their recent activity.',
  NUTRITION_SUGGESTION:
    "You are a registered dietitian reviewing a user's food log for today. Give concrete, actionable suggestions to improve their nutrition relative to their targets.",
  CHATBOT:
    'You are a friendly, knowledgeable fitness and nutrition coach embedded in a gym app. Answer general fitness, workout, and nutrition questions clearly and safely. Recommend consulting a doctor for medical concerns. Keep responses concise.',
};

async function getSettings() {
  let settings = await prisma.aiSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) {
    settings = await prisma.aiSettings.create({ data: { id: 'singleton' } });
  }
  return settings;
}

function promptFor(settings: Awaited<ReturnType<typeof getSettings>>, feature: AiFeature) {
  const overrides = (settings.prompts as Record<string, string>) ?? {};
  return overrides[feature] || DEFAULT_PROMPTS[feature];
}

function assertEnabled(settings: Awaited<ReturnType<typeof getSettings>>, feature: AiFeature) {
  const flagMap: Record<AiFeature, boolean> = {
    WORKOUT_PLAN: settings.workoutPlanEnabled,
    DIET_PLAN: settings.dietPlanEnabled,
    FORM_TIP: settings.formTipEnabled,
    MOTIVATION: settings.motivationEnabled,
    NUTRITION_SUGGESTION: settings.nutritionSuggestionEnabled,
    CHATBOT: settings.chatbotEnabled,
  };
  if (!flagMap[feature]) {
    throw new AppError('This AI feature is currently disabled by an administrator.', 403);
  }
}

async function callAi<T = string>(
  feature: AiFeature,
  userId: string | null,
  prompt: string,
  options: { systemInstruction?: string; jsonSchema?: object; parseJson?: boolean } = {}
): Promise<T> {
  const startedAt = Date.now();
  try {
    const raw = await generateWithGemini(prompt, {
      systemInstruction: options.systemInstruction,
      jsonSchema: options.jsonSchema,
    });
    const result = options.parseJson ? parseJsonResponse<T>(raw) : ((raw as unknown) as T);
    await prisma.aiLog.create({
      data: {
        userId: userId ?? undefined,
        feature,
        model: env.GEMINI_MODEL,
        prompt,
        response: raw.slice(0, 8000),
        latencyMs: Date.now() - startedAt,
      },
    });
    return result;
  } catch (err) {
    await prisma.aiLog.create({
      data: {
        userId: userId ?? undefined,
        feature,
        model: env.GEMINI_MODEL,
        prompt,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        latencyMs: Date.now() - startedAt,
      },
    });
    throw err;
  }
}

async function getUserProfileContext(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const context: string[] = [];
  if (user.age) context.push(`Age: ${user.age}`);
  if (user.gender) context.push(`Gender: ${user.gender}`);
  if (user.heightCm) context.push(`Height: ${user.heightCm}cm`);
  if (user.weightKg) context.push(`Weight: ${user.weightKg}kg`);
  if (user.targetWeightKg) context.push(`Target weight: ${user.targetWeightKg}kg`);
  if (user.fitnessGoal) context.push(`Fitness goal: ${user.fitnessGoal}`);
  if (user.experienceLevel) context.push(`Experience level: ${user.experienceLevel}`);
  if (user.activityLevel) context.push(`Activity level: ${user.activityLevel}`);
  if (user.medicalConditions.length) context.push(`Medical conditions: ${user.medicalConditions.join(', ')}`);
  if (user.allergies.length) context.push(`Allergies: ${user.allergies.join(', ')}`);

  if (user.weightKg && user.heightCm) {
    context.push(`BMI: ${calculateBmi(user.weightKg, user.heightCm)}`);
    if (user.age) {
      const bmr = calculateBmr(user.weightKg, user.heightCm, user.age, user.gender);
      context.push(`Estimated daily calorie needs: ${calculateCalorieNeeds(bmr, user.activityLevel)} kcal`);
    }
  }

  return { user, contextText: context.join('\n') || 'No profile details provided.' };
}

// ---- Workout plan generation ----

const workoutPlanJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    difficulty: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          weekNumber: { type: 'integer' },
          dayNumber: { type: 'integer' },
          title: { type: 'string' },
          isRestDay: { type: 'boolean' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exerciseId: { type: 'string' },
                order: { type: 'integer' },
                targetSets: { type: 'integer' },
                targetReps: { type: 'integer' },
                notes: { type: 'string' },
              },
              required: ['exerciseId'],
            },
          },
        },
        required: ['dayNumber', 'isRestDay', 'exercises'],
      },
    },
  },
  required: ['title', 'difficulty', 'days'],
};

export async function generateWorkoutPlan(
  userId: string,
  input: {
    goal?: string;
    daysPerWeek: number;
    focusAreas?: string[];
    sessionMinutes?: number;
    equipment?: string[];
    limitations?: string;
    save: boolean;
  }
) {
  const settings = await getSettings();
  assertEnabled(settings, 'WORKOUT_PLAN');
  if (!isGeminiConfigured()) {
    throw new AppError('AI features are not configured. An administrator must set GEMINI_API_KEY.', 503);
  }

  const { contextText } = await getUserProfileContext(userId);
  const exercises = await prisma.exercise.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, targetMuscle: true, secondaryMuscles: true, difficulty: true, equipment: true },
    take: 200,
  });
  if (exercises.length === 0) {
    throw new AppError('No exercises available in the library to build a plan from.', 422);
  }

  const exerciseCatalog = exercises
    .map((e) => `${e.id} | ${e.name} | target: ${e.targetMuscle} | difficulty: ${e.difficulty} | equipment: ${e.equipment.join(',') || 'none'}`)
    .join('\n');

  const prompt = `User profile:\n${contextText}\n\nRequested goal: ${input.goal || 'general fitness'}\nDays per week: ${input.daysPerWeek}\nFocus areas: ${input.focusAreas?.join(', ') || 'balanced full body'}\nSession length: ${input.sessionMinutes ? `about ${input.sessionMinutes} minutes` : 'not specified'}\nAvailable equipment: ${input.equipment?.length ? `${input.equipment.join(', ')} (only use exercises that need nothing else; bodyweight is always fine)` : 'full gym'}\nLimitations / injuries to work around: ${input.limitations || 'none reported'} — avoid exercises that could aggravate them and prefer safer alternatives.\n\nAvailable exercises (id | name | target muscle | difficulty | equipment):\n${exerciseCatalog}\n\nDesign a single-week workout plan using ONLY exerciseId values from the list above. Include ${input.daysPerWeek} training days plus rest days to total 7 days for weekNumber 1. Respond with JSON matching the schema.`;

  const plan = await callAi<{
    title: string;
    description?: string;
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    days: Array<{
      weekNumber?: number;
      dayNumber: number;
      title?: string;
      isRestDay: boolean;
      exercises: Array<{ exerciseId: string; order?: number; targetSets?: number; targetReps?: number; notes?: string }>;
    }>;
  }>('WORKOUT_PLAN', userId, prompt, {
    systemInstruction: promptFor(settings, 'WORKOUT_PLAN'),
    jsonSchema: workoutPlanJsonSchema,
    parseJson: true,
  });

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const sanitizedDays = plan.days.map((day) => ({
    weekNumber: day.weekNumber ?? 1,
    dayNumber: day.dayNumber,
    title: day.title,
    isRestDay: day.isRestDay,
    exercises: day.exercises.filter((ex) => exerciseById.has(ex.exerciseId)),
  }));

  const generatedPlan = {
    title: plan.title,
    description: plan.description,
    difficulty: plan.difficulty,
    days: sanitizedDays,
  };

  if (!input.save) {
    const previewDays = sanitizedDays.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({ ...ex, exerciseName: exerciseById.get(ex.exerciseId)?.name })),
    }));
    return { plan: { ...generatedPlan, days: previewDays }, saved: false };
  }

  const saved = await createUserPlan(userId, generatedPlan as never);
  return { plan: saved, saved: true };
}

// ---- Diet plan generation ----

const dietPlanJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    estimatedCalories: { type: 'integer' },
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mealType: {
            type: 'string',
            enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS', 'PRE_WORKOUT', 'POST_WORKOUT'],
          },
          title: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                foodId: { type: 'string' },
                quantityGrams: { type: 'number' },
              },
              required: ['foodId', 'quantityGrams'],
            },
          },
        },
        required: ['mealType', 'items'],
      },
    },
  },
  required: ['title', 'meals'],
};

export async function generateDietPlan(
  userId: string,
  input: { goal?: string; mealsPerDay: number; dietaryPreferences?: string[]; save: boolean }
) {
  const settings = await getSettings();
  assertEnabled(settings, 'DIET_PLAN');
  if (!isGeminiConfigured()) {
    throw new AppError('AI features are not configured. An administrator must set GEMINI_API_KEY.', 503);
  }

  const { contextText } = await getUserProfileContext(userId);
  const foods = await prisma.food.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, caloriesPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
    take: 300,
  });
  if (foods.length === 0) {
    throw new AppError('No foods available in the library to build a plan from.', 422);
  }

  const foodCatalog = foods
    .map((f) => `${f.id} | ${f.name} | ${f.caloriesPer100g}kcal/100g | P:${f.proteinPer100g} C:${f.carbsPer100g} F:${f.fatPer100g}`)
    .join('\n');

  const prompt = `User profile:\n${contextText}\n\nRequested goal: ${input.goal || 'balanced nutrition'}\nMeals per day: ${input.mealsPerDay}\nDietary preferences/restrictions: ${input.dietaryPreferences?.join(', ') || 'none'}\n\nAvailable foods (id | name | calories/100g | macros):\n${foodCatalog}\n\nDesign a one-day meal plan using ONLY foodId values from the list above, with realistic quantityGrams per item. Respond with JSON matching the schema.`;

  const plan = await callAi<{
    title: string;
    description?: string;
    estimatedCalories?: number;
    meals: Array<{
      mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACKS' | 'PRE_WORKOUT' | 'POST_WORKOUT';
      title?: string;
      items: Array<{ foodId: string; quantityGrams: number }>;
    }>;
  }>('DIET_PLAN', userId, prompt, {
    systemInstruction: promptFor(settings, 'DIET_PLAN'),
    jsonSchema: dietPlanJsonSchema,
    parseJson: true,
  });

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const sanitizedMeals = plan.meals.map((meal) => ({
    mealType: meal.mealType,
    title: meal.title,
    items: meal.items.filter((item) => foodById.has(item.foodId)),
  }));

  const generatedPlan = {
    title: plan.title,
    description: plan.description,
    estimatedCalories: plan.estimatedCalories,
    meals: sanitizedMeals,
  };

  if (!input.save) {
    const previewMeals = sanitizedMeals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => ({ ...item, foodName: foodById.get(item.foodId)?.name })),
    }));
    return { plan: { ...generatedPlan, meals: previewMeals }, saved: false };
  }

  const saved = await createUserDietPlan(userId, generatedPlan as never);
  return { plan: saved, saved: true };
}

// ---- Exercise form tips ----

export async function getFormTip(userId: string, exerciseId: string) {
  const settings = await getSettings();
  assertEnabled(settings, 'FORM_TIP');

  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, deletedAt: null } });
  if (!exercise) throw new AppError('Exercise not found', 404);

  const prompt = `Exercise: ${exercise.name}\nTarget muscle: ${exercise.targetMuscle}\nEquipment: ${exercise.equipment.join(', ') || 'none'}\nKnown common mistakes: ${exercise.commonMistakes.join('; ') || 'none listed'}\n\nGive 3-5 concise bullet-point form tips and 1-2 safety warnings for performing this exercise correctly.`;

  const tip = await callAi<string>('FORM_TIP', userId, prompt, {
    systemInstruction: promptFor(settings, 'FORM_TIP'),
  });

  return { exerciseId, exerciseName: exercise.name, tip };
}

// ---- Daily motivation message ----

export async function getMotivationMessage(userId: string) {
  const settings = await getSettings();
  assertEnabled(settings, 'MOTIVATION');

  const { user, contextText } = await getUserProfileContext(userId);
  const streak = await prisma.userStreak.findUnique({ where: { userId } });
  const recentWorkouts = await prisma.workoutLog.count({
    where: { userId, completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });

  const prompt = `User profile:\n${contextText}\nCurrent streak: ${streak?.currentStreak ?? 0} days\nWorkouts completed in the last 7 days: ${recentWorkouts}\nName: ${user.name || 'there'}\n\nWrite one short (2-3 sentence) motivational message for this user's fitness journey today.`;

  const message = await callAi<string>('MOTIVATION', userId, prompt, {
    systemInstruction: promptFor(settings, 'MOTIVATION'),
  });

  return { message };
}

// ---- Nutrition suggestions ----

export async function getNutritionSuggestion(userId: string) {
  const settings = await getSettings();
  assertEnabled(settings, 'NUTRITION_SUGGESTION');

  const { contextText } = await getUserProfileContext(userId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const logs = await prisma.nutritionLog.findMany({
    where: { userId, loggedAt: { gte: startOfDay } },
    include: { food: true },
  });

  if (logs.length === 0) {
    return { suggestion: "You haven't logged any food today yet — log a meal to get personalized nutrition suggestions." };
  }

  const totals = logs.reduce(
    (acc, log) => {
      const factor = log.quantityGrams / 100;
      acc.calories += log.food.caloriesPer100g * factor;
      acc.protein += log.food.proteinPer100g * factor;
      acc.carbs += log.food.carbsPer100g * factor;
      acc.fat += log.food.fatPer100g * factor;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const loggedFoods = logs.map((l) => `${l.food.name} (${l.quantityGrams}g, ${l.mealType})`).join(', ');

  const prompt = `User profile:\n${contextText}\n\nToday's food log: ${loggedFoods}\nTotals so far: ${Math.round(totals.calories)}kcal, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, ${Math.round(totals.fat)}g fat\n\nGive 2-4 concrete, actionable suggestions to improve today's nutrition relative to the user's goal.`;

  const suggestion = await callAi<string>('NUTRITION_SUGGESTION', userId, prompt, {
    systemInstruction: promptFor(settings, 'NUTRITION_SUGGESTION'),
  });

  return { suggestion, totals };
}

// ---- Chatbot ----

export async function chatWithCoach(userId: string, message: string) {
  const settings = await getSettings();
  assertEnabled(settings, 'CHATBOT');
  if (!isGeminiConfigured()) {
    throw new AppError('AI features are not configured. An administrator must set GEMINI_API_KEY.', 503);
  }

  await prisma.aiChatMessage.create({ data: { userId, role: 'user', content: message } });

  const history = await prisma.aiChatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const conversation = history
    .reverse()
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n');

  const prompt = `Conversation so far:\n${conversation}\n\nRespond as the Coach to the most recent User message.`;

  const reply = await callAi<string>('CHATBOT', userId, prompt, {
    systemInstruction: promptFor(settings, 'CHATBOT'),
  });

  await prisma.aiChatMessage.create({ data: { userId, role: 'assistant', content: reply } });

  return { reply };
}

export async function listChatHistory(userId: string) {
  const messages = await prisma.aiChatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  return { messages };
}

export async function clearChatHistory(userId: string) {
  await prisma.aiChatMessage.deleteMany({ where: { userId } });
}

// ---- Admin ----

export async function getAiSettings() {
  return getSettings();
}

export async function updateAiSettings(data: {
  workoutPlanEnabled?: boolean;
  dietPlanEnabled?: boolean;
  formTipEnabled?: boolean;
  motivationEnabled?: boolean;
  nutritionSuggestionEnabled?: boolean;
  chatbotEnabled?: boolean;
  prompts?: Record<string, string>;
}) {
  const current = await getSettings();
  const mergedPrompts = { ...(current.prompts as Record<string, string>), ...(data.prompts ?? {}) };
  return prisma.aiSettings.update({
    where: { id: 'singleton' },
    data: { ...data, prompts: mergedPrompts },
  });
}

export async function listAiLogs(feature: AiFeature | undefined, page: number, pageSize: number) {
  const where = feature ? { feature } : {};
  const [logs, total] = await Promise.all([
    prisma.aiLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.aiLog.count({ where }),
  ]);
  return { logs, total, page, pageSize };
}

export function isAiConfigured() {
  return isGeminiConfigured();
}
