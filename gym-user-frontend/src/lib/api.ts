import { apiClient } from "@/lib/api-client";
import { AuthUser } from "@/stores/auth-store";

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export async function registerUser(input: { email: string; password: string; name: string }) {
  const { data } = await apiClient.post<{ user: AuthUser; message: string }>("/auth/register", input);
  return data;
}

export async function verifyEmail(input: { email: string; code: string }) {
  const { data } = await apiClient.post<AuthResponse>("/auth/verify-email", input);
  return data;
}

export async function loginUser(input: { email: string; password: string }) {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
  return data;
}

export async function googleLogin(idToken: string) {
  const { data } = await apiClient.post<AuthResponse>("/auth/google", { idToken });
  return data;
}

export interface Exercise {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  targetMuscle: string;
  equipment: string[];
  caloriesBurnedEstimate: number | null;
  categories: { id: string; name: string; slug: string }[];
}

export async function listExercises(params: { search?: string; category?: string; difficulty?: string }) {
  const { data } = await apiClient.get<{ items: Exercise[]; pagination: { total: number } }>("/exercises", {
    params,
  });
  return data;
}

export interface ExerciseCategory {
  id: string;
  name: string;
  slug: string;
}

export async function listExerciseCategories() {
  const { data } = await apiClient.get<{ categories: ExerciseCategory[] }>("/exercise-categories");
  return data.categories;
}

export interface DashboardData {
  profile: {
    currentWeightKg: number | null;
    heightCm: number | null;
    targetWeightKg: number | null;
    fitnessGoal: string | null;
  };
  metrics: {
    bmi: number | null;
    bmiCategory: string | null;
    bmr: number | null;
    calorieNeeds: number | null;
    waterIntakeLiters: number | null;
  };
  streak: { currentStreak: number; longestStreak: number };
  activePlan: { id: string; title: string } | null;
  gymAttendanceStatus: { checkedIn: boolean };
  dailyMissionProgress: { total: number; completed: number };
  today: {
    workout: {
      planId: string;
      planTitle: string;
      day: {
        title: string | null;
        isRestDay: boolean;
        exercises: Array<{ id: string; exercise: { name: string }; targetSets: number | null; targetReps: number | null }>;
      };
    } | null;
    diet: {
      id: string;
      title: string;
      meals: Array<{ id: string; mealType: string; title: string | null }>;
    } | null;
  };
}

export async function getDashboard() {
  const { data } = await apiClient.get<DashboardData>("/users/me/dashboard");
  return data;
}
