import { apiClient } from "@/lib/api-client";

export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export async function getMyStreak() {
  const { data } = await apiClient.get<{ streak: Streak }>("/streaks/me");
  return data.streak;
}

export interface MissionProgress {
  currentValue: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface Mission {
  id: string;
  title: string;
  description: string | null;
  conditionType: string;
  targetValue: number;
  rewardCoins: number;
  rewardXp: number;
  endDate: string;
  progress: MissionProgress;
}

export async function listActiveMissions() {
  const { data } = await apiClient.get<{ missions: Mission[] }>("/missions");
  return data.missions;
}

export async function reportMissionProgress(missionId: string, value: number) {
  const { data } = await apiClient.post(`/missions/${missionId}/progress`, { value });
  return data;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
}

export interface UserBadge {
  id: string;
  awardedAt: string;
  badge: Badge;
}

export async function listMyBadges() {
  const { data } = await apiClient.get<{ badges: UserBadge[] }>("/badges/me");
  return data.badges;
}
