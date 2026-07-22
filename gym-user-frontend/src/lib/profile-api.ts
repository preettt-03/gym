import { apiClient } from "@/lib/api-client";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  fitnessGoal: string | null;
  experienceLevel: string | null;
  activityLevel: string | null;
  gymName: string | null;
  coins: number;
  xp: number;
}

export async function getMyProfile() {
  const { data } = await apiClient.get<{ user: UserProfile }>("/users/me");
  return data.user;
}

export interface UpdateProfileInput {
  name?: string;
  age?: number;
  gender?: "MALE" | "FEMALE" | "OTHER";
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  fitnessGoal?: "WEIGHT_LOSS" | "MUSCLE_GAIN" | "MAINTENANCE" | "ENDURANCE" | "GENERAL_FITNESS";
  experienceLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  activityLevel?: "SEDENTARY" | "LIGHTLY_ACTIVE" | "MODERATELY_ACTIVE" | "VERY_ACTIVE" | "EXTRA_ACTIVE";
  gymName?: string;
}

export async function updateMyProfile(input: UpdateProfileInput) {
  const { data } = await apiClient.patch<{ user: UserProfile }>("/users/me/profile", input);
  return data.user;
}
