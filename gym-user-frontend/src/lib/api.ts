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

// `identifier` is whatever the member typed: an email or a mobile number.
export async function loginUser(input: { identifier: string; password: string }) {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
  return data;
}

// Both always succeed with the same message whether or not the account
// exists; cooldownSeconds tells the UI how long to disable "resend".
export interface CodeSentResponse {
  message: string;
  cooldownSeconds: number;
}

export async function resendVerificationCode(email: string) {
  const { data } = await apiClient.post<CodeSentResponse>("/auth/resend-otp", { email });
  return data;
}

export async function requestPasswordReset(email: string) {
  const { data } = await apiClient.post<CodeSentResponse>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(input: { email: string; code: string; newPassword: string }) {
  const { data } = await apiClient.post<{ message: string }>("/auth/reset-password", input);
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
  secondaryMuscles: string[];
  equipment: string[];
  caloriesBurnedEstimate: number | null;
  instructions: string[];
  media: ExerciseMedia[];
  /** The flagged photo, else the first one. */
  thumbnailUrl: string | null;
  photoCount: number;
  videoCount: number;
  categories: { id: string; name: string; slug: string }[];
}

export interface ExerciseMedia {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  label: string | null;
  isThumbnail: boolean;
  provider: "upload" | "youtube" | "vimeo" | null;
}

export async function listExercises(params: {
  search?: string;
  category?: string;
  difficulty?: string;
  muscleGroup?: string;
  page?: number;
  limit?: number;
}) {
  const { data } = await apiClient.get<{
    items: Exercise[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>("/exercises", {
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

// ---------- Mobile number sign-in ----------

export type PhoneMode = "login" | "signup";

export async function getAuthMethods() {
  const { data } = await apiClient.get<{ email: boolean; phone: boolean; google: boolean }>("/auth/methods");
  return data;
}

export async function sendPhoneOtp(input: { phone: string; mode: PhoneMode; name?: string; password?: string }) {
  // devCode only comes back in local test mode (no SMS provider configured).
  const { data } = await apiClient.post<{ phone: string; cooldownSeconds: number; devCode?: string }>("/auth/phone/send-otp", input);
  return data;
}

export async function verifyPhoneOtp(input: { phone: string; mode: PhoneMode; code: string }) {
  const { data } = await apiClient.post<AuthResponse>("/auth/phone/verify", input);
  return data;
}

// ---------- One-time-code login (email or mobile) ----------

export interface CodeSent {
  channel: "email" | "sms";
  sentTo: string;
  cooldownSeconds: number;
  devCode?: string;
}

export async function sendLoginOtp(identifier: string) {
  const { data } = await apiClient.post<CodeSent>("/auth/otp/send", { identifier });
  return data;
}

export async function verifyLoginOtp(identifier: string, code: string) {
  const { data } = await apiClient.post<AuthResponse>("/auth/otp/verify", { identifier, code });
  return data;
}

/** The sign-in box takes either; anything with an @ is treated as an email. */
export const isEmailIdentifier = (value: string) => value.includes("@");
