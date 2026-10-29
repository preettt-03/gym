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

// Photos are stored privately: the file goes straight to this endpoint (not the public
// /uploads), and photoUrl comes back as a signed link that expires after an hour.
export async function createProgressPhoto(file: File, notes?: string) {
  const formData = new FormData();
  formData.append("photo", file);
  if (notes) formData.append("notes", notes);
  const { data } = await apiClient.post<{ photo: ProgressPhoto }>("/progress-photos", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.photo;
}

// Re-fetch well before the signed links expire so images keep loading on a long-open page.
export const PHOTO_URL_REFRESH_MS = 45 * 60 * 1000;

export async function deleteProgressPhoto(id: string) {
  await apiClient.delete(`/progress-photos/${id}`);
}

// Mirrors the server's upload rules so bad files fail fast in the browser.
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
