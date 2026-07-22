import { apiClient } from "@/lib/api-client";
import type { WorkoutPlanSummary } from "@/lib/workout-api";
import type { DietPlanSummary } from "@/lib/diet-api";

export interface Trainee {
  id: string;
  name: string | null;
  email: string;
  photoUrl: string | null;
  fitnessGoal: string | null;
  experienceLevel: string | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  streak: { currentStreak: number; longestStreak: number } | null;
}

export interface TraineeOverview {
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
}

export interface TraineeWorkoutLog {
  id: string;
  date: string;
  completedAt: string | null;
  notes: string | null;
  plan: { title: string } | null;
}

export interface WeightLogEntry {
  id: string;
  weightKg: number;
  loggedAt: string;
}

export interface AttendanceEntry {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
}

export async function listTrainees() {
  const { data } = await apiClient.get<{ trainees: Trainee[] }>("/trainer/trainees");
  return data.trainees;
}

export async function getTraineeProfile(traineeId: string) {
  const { data } = await apiClient.get(`/trainer/trainees/${traineeId}`);
  return data.profile;
}

export async function getTraineeOverview(traineeId: string) {
  const { data } = await apiClient.get<TraineeOverview>(`/trainer/trainees/${traineeId}/overview`);
  return data;
}

export async function listTraineeWorkoutLogs(traineeId: string) {
  const { data } = await apiClient.get<{ logs: TraineeWorkoutLog[] }>(
    `/trainer/trainees/${traineeId}/workout-logs`
  );
  return data.logs;
}

export async function listTraineeWeightLogs(traineeId: string) {
  const { data } = await apiClient.get<{ logs: WeightLogEntry[] }>(`/trainer/trainees/${traineeId}/weight-logs`);
  return data.logs;
}

export async function listTraineeAttendance(traineeId: string) {
  const { data } = await apiClient.get<{ attendance: AttendanceEntry[] }>(
    `/trainer/trainees/${traineeId}/attendance`
  );
  return data.attendance;
}

export async function listAssignableWorkoutPlans() {
  const { data } = await apiClient.get<{ plans: WorkoutPlanSummary[] }>("/trainer/workout-plans");
  return data.plans;
}

export async function listAssignableDietPlans() {
  const { data } = await apiClient.get<{ plans: DietPlanSummary[] }>("/trainer/diet-plans");
  return data.plans;
}

export async function assignWorkoutPlanToTrainee(traineeId: string, planId: string) {
  await apiClient.post(`/trainer/trainees/${traineeId}/assign-workout-plan`, { planId });
}

export async function assignDietPlanToTrainee(traineeId: string, planId: string) {
  await apiClient.post(`/trainer/trainees/${traineeId}/assign-diet-plan`, { planId });
}

export async function sendNoteToTrainee(traineeId: string, title: string, body?: string) {
  await apiClient.post(`/trainer/trainees/${traineeId}/notes`, { title, body });
}
