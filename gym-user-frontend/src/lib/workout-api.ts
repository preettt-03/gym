import { apiClient } from "@/lib/api-client";

export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface WorkoutPlanSummary {
  id: string;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  estimatedCalories: number | null;
  estimatedMinutes: number | null;
  source: "ADMIN" | "USER";
}

export interface WorkoutPlanExerciseEntry {
  id: string;
  order: number;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  notes: string | null;
  isSwapped?: boolean;
  exercise: { id: string; name: string; targetMuscle: string };
}

export interface WorkoutPlanDay {
  id: string;
  weekNumber: number;
  dayNumber: number;
  title: string | null;
  isRestDay: boolean;
  exercises: WorkoutPlanExerciseEntry[];
}

export interface WorkoutPlanDetail extends WorkoutPlanSummary {
  days: WorkoutPlanDay[];
}

export async function listMyWorkoutPlans() {
  const { data } = await apiClient.get<{ ownedPlans: WorkoutPlanSummary[]; assignedPlans: WorkoutPlanSummary[] }>(
    "/workout-plans"
  );
  return data;
}

export async function getWorkoutPlan(id: string) {
  const { data } = await apiClient.get<{ plan: WorkoutPlanDetail }>(`/workout-plans/${id}`);
  return data.plan;
}

export async function completeWorkoutDay(dayId: string, notes?: string) {
  const { data } = await apiClient.post(`/workout-plans/days/${dayId}/complete`, {
    notes,
    exerciseLogs: [],
  });
  return data;
}
