import { apiClient } from "@/lib/api-client";

export interface WeightLog {
  id: string;
  weightKg: number;
  loggedAt: string;
}

export async function listWeightLogs() {
  const { data } = await apiClient.get<{ logs: WeightLog[] }>("/users/me/weight-logs");
  return data.logs;
}

export async function logWeight(weightKg: number) {
  const { data } = await apiClient.post<{ log: WeightLog }>("/users/me/weight-logs", { weightKg });
  return data.log;
}

export interface WorkoutLogSummary {
  id: string;
  date: string;
  completedAt: string | null;
  day: { title: string | null } | null;
  plan: { title: string } | null;
  exerciseLogs: { id: string }[];
}

export async function listWorkoutHistory() {
  const { data } = await apiClient.get<{ items: WorkoutLogSummary[]; pagination: { total: number } }>(
    "/workout-logs"
  );
  return data;
}

export interface ProgressPhoto {
  id: string;
  photoUrl: string;
  notes: string | null;
  takenAt: string;
}

export async function listProgressPhotos() {
  const { data } = await apiClient.get<{ photos: ProgressPhoto[] }>("/progress-photos");
  return data.photos;
}

export async function uploadProgressPhotoFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<{ url: string }>("/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}

export async function createProgressPhoto(photoUrl: string, notes?: string) {
  const { data } = await apiClient.post<{ photo: ProgressPhoto }>("/progress-photos", { photoUrl, notes });
  return data.photo;
}
