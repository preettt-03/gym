import { apiClient } from "@/lib/api-client";

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACKS" | "PRE_WORKOUT" | "POST_WORKOUT";

export interface DietPlanSummary {
  id: string;
  title: string;
  description: string | null;
  estimatedCalories: number | null;
  source: "ADMIN" | "USER";
}

export interface NutritionBreakdown {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodiumMg: number | null;
}

export interface DietPlanMealItem {
  id: string;
  quantityGrams: number;
  notes: string | null;
  food: { id: string; name: string };
  nutrition: NutritionBreakdown;
}

export interface DietPlanMeal {
  id: string;
  mealType: MealType;
  title: string | null;
  items: DietPlanMealItem[];
}

export interface DietPlanDetail extends DietPlanSummary {
  categories: { id: string; name: string }[];
  meals: DietPlanMeal[];
}

export async function listMyDietPlans() {
  const { data } = await apiClient.get<{ ownedPlans: DietPlanSummary[]; assignedPlans: DietPlanSummary[] }>(
    "/diet-plans"
  );
  return data;
}

export async function getDietPlan(id: string) {
  const { data } = await apiClient.get<{ plan: DietPlanDetail }>(`/diet-plans/${id}`);
  return data.plan;
}

export interface Food {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export async function searchFoods(search: string) {
  const { data } = await apiClient.get<{ items: Food[] }>("/foods", { params: { search } });
  return data.items;
}

export interface NutritionLogEntry {
  id: string;
  quantityGrams: number;
  mealType: MealType | null;
  loggedAt: string;
  food: { id: string; name: string };
  nutrition: NutritionBreakdown;
}

export interface DailyNutrition {
  date: string;
  entries: NutritionLogEntry[];
  totals: NutritionBreakdown;
}

export async function logFood(input: { foodId: string; quantityGrams: number; mealType?: MealType; loggedAt?: string }) {
  const { data } = await apiClient.post<{ log: NutritionLogEntry }>("/nutrition-logs", input);
  return data.log;
}

export async function getDailyNutrition(date?: string) {
  const { data } = await apiClient.get<DailyNutrition>("/nutrition-logs", { params: { date } });
  return data;
}

export async function deleteNutritionLog(id: string) {
  await apiClient.delete(`/nutrition-logs/${id}`);
}

// Saves a plan exactly as previewed (e.g. an AI draft) as the member's own plan.
export async function createDietPlan(plan: {
  title: string;
  description?: string;
  estimatedCalories?: number;
  meals: Array<{ mealType: string; title?: string; items: Array<{ foodId: string; quantityGrams: number }> }>;
}) {
  const { data } = await apiClient.post<{ plan: DietPlanDetail }>("/diet-plans", {
    title: plan.title,
    description: plan.description || undefined,
    estimatedCalories: plan.estimatedCalories ? Math.round(plan.estimatedCalories) : undefined,
    meals: plan.meals.map((m) => ({
      mealType: m.mealType,
      title: m.title || undefined,
      items: m.items.filter((i) => i.quantityGrams > 0).map((i) => ({ foodId: i.foodId, quantityGrams: i.quantityGrams })),
    })),
  });
  return data.plan;
}

export const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACKS: "Snacks",
  PRE_WORKOUT: "Pre-workout",
  POST_WORKOUT: "Post-workout",
};

export const MEAL_ORDER: MealType[] = ["BREAKFAST", "PRE_WORKOUT", "LUNCH", "SNACKS", "POST_WORKOUT", "DINNER"];
