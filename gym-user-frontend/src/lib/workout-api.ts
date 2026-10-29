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
  exercise: { id: string; name: string; targetMuscle: string; slug?: string };
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

// Saves a plan exactly as previewed (e.g. an AI draft) as the member's own plan.
export async function createWorkoutPlan(plan: {
  title: string;
  description?: string;
  difficulty: Difficulty;
  days: Array<{
    weekNumber?: number;
    dayNumber: number;
    title?: string;
    isRestDay: boolean;
    exercises: Array<{ exerciseId: string; order?: number; targetSets?: number; targetReps?: number; notes?: string }>;
  }>;
}) {
  const body = {
    title: plan.title,
    description: plan.description || undefined,
    difficulty: plan.difficulty,
    days: plan.days.map((d) => ({
      weekNumber: d.weekNumber ?? 1,
      dayNumber: d.dayNumber,
      title: d.title || undefined,
      isRestDay: d.isRestDay,
      exercises: d.exercises.map((e, i) => ({
        exerciseId: e.exerciseId,
        order: e.order ?? i,
        targetSets: e.targetSets || undefined,
        targetReps: e.targetReps || undefined,
        notes: e.notes || undefined,
      })),
    })),
  };
  const { data } = await apiClient.post<{ plan: WorkoutPlanDetail }>("/workout-plans", body);
  return data.plan;
}
