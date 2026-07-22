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

export async function logFood(input: { foodId: string; quantityGrams: number; mealType?: MealType }) {
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
