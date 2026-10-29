import { apiClient } from "@/lib/api-client";
import { WorkoutPlanDetail } from "@/lib/workout-api";
import { DietPlanDetail } from "@/lib/diet-api";

export interface GeneratedWorkoutDay {
  weekNumber: number;
  dayNumber: number;
  title?: string;
  isRestDay: boolean;
  exercises: Array<{
    exerciseId: string;
    exerciseName?: string;
    order?: number;
    targetSets?: number;
    targetReps?: number;
    notes?: string;
  }>;
}

export interface GeneratedWorkoutPlan {
  title: string;
  description?: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  days: GeneratedWorkoutDay[];
}

export interface GeneratedDietMeal {
  mealType: string;
  title?: string;
  items: Array<{ foodId: string; foodName?: string; quantityGrams: number }>;
}

export interface GeneratedDietPlan {
  title: string;
  description?: string;
  estimatedCalories?: number;
  meals: GeneratedDietMeal[];
}

export async function getAiStatus() {
  const { data } = await apiClient.get<{ configured: boolean }>("/ai/status");
  return data;
}

export async function generateWorkoutPlan(input: {
  goal?: string;
  daysPerWeek: number;
  focusAreas?: string[];
  sessionMinutes?: number;
  equipment?: string[];
  limitations?: string;
  save: boolean;
}) {
  const { data } = await apiClient.post<
    { plan: GeneratedWorkoutPlan; saved: false } | { plan: WorkoutPlanDetail; saved: true }
  >("/ai/workout-plan", input);
  return data;
}

export async function generateDietPlan(input: {
  goal?: string;
  mealsPerDay: number;
  dietaryPreferences?: string[];
  save: boolean;
}) {
  const { data } = await apiClient.post<
    { plan: GeneratedDietPlan; saved: false } | { plan: DietPlanDetail; saved: true }
  >("/ai/diet-plan", input);
  return data;
}

export async function getFormTip(exerciseId: string) {
  const { data } = await apiClient.post<{ exerciseId: string; exerciseName: string; tip: string }>(
    "/ai/form-tip",
    { exerciseId }
  );
  return data;
}

export async function getMotivationMessage() {
  const { data } = await apiClient.get<{ message: string }>("/ai/motivation");
  return data;
}

export async function getNutritionSuggestion() {
  const { data } = await apiClient.get<{ suggestion: string }>("/ai/nutrition-suggestion");
  return data;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function sendAiChatMessage(message: string) {
  const { data } = await apiClient.post<{ reply: string }>("/ai/chat", { message });
  return data;
}

export async function getAiChatHistory() {
  const { data } = await apiClient.get<{ messages: AiChatMessage[] }>("/ai/chat/history");
  return data;
}

export async function clearAiChatHistory() {
  await apiClient.delete("/ai/chat/history");
}
