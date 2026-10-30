import { apiClient } from "@/lib/api-client";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";
export type FraudFlag = "TOO_MANY_WORKOUTS" | "TOO_MANY_CALORIES" | "LONG_VISIT";
export type CyclePeriod = Exclude<LeaderboardPeriod, "all-time">;

export interface RewardTier {
  enabled: boolean;
  coins: [number, number, number];
  xp: [number, number, number];
}
export type RewardsConfig = Record<CyclePeriod, RewardTier>;

export interface LeaderboardSettings {
  isEnabled: boolean;
  workoutPoints: number;
  visitPoints: number;
  caloriesPerPoint: number;
  gymMinutePoints: number;
  workoutMinutePoints: number;
  streakPoints: number;
  fraudDetection: boolean;
  maxWorkoutsPerDay: number;
  maxCaloriesPerDay: number;
  maxGymMinutesPerVisit: number;
  autoFreeze: boolean;
  overtakeAlerts: boolean;
  weeklyWrapUp: boolean;
  rewards: RewardsConfig;
  displayKey: string | null;
  updatedAt: string;
}

export interface AdminLeaderboardEntry {
  rank: number | null;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  points: number;
  basePoints: number;
  adjustmentPoints: number;
  workouts: number;
  visits: number;
  caloriesBurned: number;
  gymMinutes: number;
  workoutMinutes: number;
  streakDays: number;
  flags: FraudFlag[];
  frozen: boolean;
  hidden: boolean;
  hiddenReason: string | null;
}

export interface LeaderboardAdjustment {
  id: string;
  points: number;
  reason: string;
  effectiveAt: string;
  createdBy: { id: string; name: string | null; email: string | null } | null;
}

export async function getAdminLeaderboard(period: LeaderboardPeriod, offset: number) {
  const { data } = await apiClient.get<{
    period: LeaderboardPeriod;
    offset: number;
    range: { start: string; end: string };
    settings: LeaderboardSettings;
    entries: AdminLeaderboardEntry[];
  }>("/admin/leaderboard", { params: { period, offset } });
  return data;
}

export async function getLeaderboardSettings() {
  const { data } = await apiClient.get<{ settings: LeaderboardSettings }>("/admin/leaderboard/settings");
  return data.settings;
}

export async function updateLeaderboardSettings(input: Partial<Omit<LeaderboardSettings, "updatedAt" | "displayKey">>) {
  const { data } = await apiClient.put<{ settings: LeaderboardSettings }>("/admin/leaderboard/settings", input);
  return data.settings;
}

export async function addLeaderboardAdjustment(input: { userId: string; points: number; reason: string }) {
  const { data } = await apiClient.post<{ adjustment: LeaderboardAdjustment }>("/admin/leaderboard/adjustments", input);
  return data.adjustment;
}

export async function deleteLeaderboardAdjustment(id: string) {
  await apiClient.delete(`/admin/leaderboard/adjustments/${id}`);
}

export async function listLeaderboardAdjustments(userId: string) {
  const { data } = await apiClient.get<{ adjustments: LeaderboardAdjustment[] }>(`/admin/leaderboard/members/${userId}/adjustments`);
  return data.adjustments;
}

export async function setLeaderboardVisibility(userId: string, hidden: boolean, reason?: string) {
  await apiClient.put(`/admin/leaderboard/members/${userId}/visibility`, { hidden, reason });
}

export async function downloadLeaderboard(period: LeaderboardPeriod, offset: number, format: "csv" | "xlsx") {
  const { data } = await apiClient.get("/admin/leaderboard/export", { params: { period, offset, format }, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `leaderboard-${period}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function recalculateLeaderboard() {
  await apiClient.post("/admin/leaderboard/recalculate");
}

export async function approveLeaderboardMember(userId: string) {
  await apiClient.post(`/admin/leaderboard/members/${userId}/approve`);
}

export async function setDisplayLink(enabled: boolean) {
  const { data } = await apiClient.put<{ settings: LeaderboardSettings }>("/admin/leaderboard/display-key", { enabled });
  return data.settings;
}

export async function closeLeaderboardCycles() {
  const { data } = await apiClient.post<{ closed: { period: CyclePeriod; winners: number }[] }>("/admin/leaderboard/cycles/close");
  return data.closed;
}

export interface LeaderboardSnapshot {
  id: string;
  period: CyclePeriod;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  awards: { id: string; rank: number; points: number; coins: number; xp: number; badgeName: string | null; user: { id: string; name: string | null; photoUrl: string | null } }[];
}

export async function listLeaderboardSnapshots(period?: CyclePeriod) {
  const { data } = await apiClient.get<{ snapshots: LeaderboardSnapshot[] }>("/admin/leaderboard/snapshots", { params: { period } });
  return data.snapshots;
}
