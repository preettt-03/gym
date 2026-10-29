import { apiClient } from "@/lib/api-client";
import type { Exercise } from "@/lib/api";

export interface ExerciseDetail extends Exercise {
  commonMistakes: string[];
  coachTip: string | null;
  gifUrl: string | null;
  durationMinutes: number | null;
  workoutType: string | null;
}

export async function getExercise(slug: string) {
  const { data } = await apiClient.get<{ exercise: ExerciseDetail }>(`/exercises/${encodeURIComponent(slug)}`);
  return data.exercise;
}

export async function listFavoriteExercises() {
  const { data } = await apiClient.get<{ items: Exercise[] }>("/exercises/favorites");
  return data.items;
}

export async function listRecentExercises() {
  const { data } = await apiClient.get<{ items: (Exercise & { viewedAt: string })[] }>("/exercises/recent");
  return data.items;
}

// Idempotent: PUT adds, DELETE removes — safe to repeat.
export async function setExerciseFavorite(id: string, favorited: boolean) {
  const { data } = favorited
    ? await apiClient.put<{ favorited: boolean }>(`/exercises/${id}/favorite`)
    : await apiClient.delete<{ favorited: boolean }>(`/exercises/${id}/favorite`);
  return data.favorited;
}

export async function clearRecentExercises() {
  await apiClient.delete("/exercises/recent");
}

export type BodyFatGender = "MALE" | "FEMALE";

export interface BodyFatResult {
  bodyFatPercent: number;
  category: string;
  method: string;
}

export async function calculateBodyFat(input: {
  gender: BodyFatGender;
  heightCm: number;
  neckCm: number;
  waistCm: number;
  hipCm?: number;
}) {
  const { data } = await apiClient.post<BodyFatResult>("/calculators/body-fat", input);
  return data;
}
