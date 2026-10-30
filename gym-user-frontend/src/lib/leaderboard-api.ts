import { apiClient } from "@/lib/api-client";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";
export type CyclePeriod = Exclude<LeaderboardPeriod, "all-time">;
export type LeaderboardSegment = "all" | "women" | "men" | "beginner" | "intermediate" | "advanced" | "fat-loss" | "strength";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  photoUrl: string | null;
  points: number;
  workouts: number;
  visits: number;
  caloriesBurned: number;
  gymMinutes: number;
  workoutMinutes: number;
  streakDays: number;
  highFives: number;
  highFivedByMe: boolean;
}

export interface RewardTier {
  enabled: boolean;
  coins: [number, number, number];
  xp: [number, number, number];
}

export interface LeaderboardWeights {
  workoutPoints: number;
  visitPoints: number;
  caloriesPerPoint: number;
  gymMinutePoints: number;
  workoutMinutePoints: number;
  streakPoints: number;
}

export type LeaderboardResponse =
  | { enabled: false; period: LeaderboardPeriod; segment: LeaderboardSegment; entries: [] }
  | {
      enabled: true;
      period: LeaderboardPeriod;
      segment: LeaderboardSegment;
      range: { start: string; end: string };
      entries: LeaderboardEntry[];
      totalRanked: number;
      me: { rank: number | null; points: number; pointsBehindNext: number } | null;
      weights: LeaderboardWeights;
      rewards: Record<CyclePeriod, RewardTier>;
    };

export async function getLeaderboard(period: LeaderboardPeriod, segment: LeaderboardSegment = "all") {
  const { data } = await apiClient.get<LeaderboardResponse>("/leaderboard", { params: { period, segment } });
  return data;
}

export async function giveHighFive(toUserId: string, period: LeaderboardPeriod) {
  const { data } = await apiClient.post<{ count: number; highFivedByMe: boolean }>("/leaderboard/high-fives", { toUserId, period });
  return data;
}

export interface Celebration {
  id: string;
  rank: number;
  points: number;
  coins: number;
  xp: number;
  badgeName: string | null;
  period: CyclePeriod;
  periodStart: string;
  periodEnd: string;
}

export async function listCelebrations() {
  const { data } = await apiClient.get<{ celebrations: Celebration[] }>("/leaderboard/celebrations");
  return data.celebrations;
}

export async function markCelebrationSeen(id: string) {
  await apiClient.post(`/leaderboard/celebrations/${id}/seen`);
}

export interface DisplayBoard {
  period: "daily" | "weekly";
  range: { start: string; end: string };
  entries: { rank: number; name: string; photoUrl: string | null; points: number; workouts: number; caloriesBurned: number; gymMinutes: number }[];
}

export async function getDisplayBoards(key: string) {
  const { data } = await apiClient.get<{ enabled: boolean; boards: DisplayBoard[] }>("/leaderboard/display", { params: { key } });
  return data;
}

export interface HallOfFameCycle {
  id: string;
  period: CyclePeriod;
  periodStart: string;
  periodEnd: string;
  podium: Omit<LeaderboardEntry, "highFives" | "highFivedByMe">[];
}

export async function getHallOfFame(period: CyclePeriod) {
  const { data } = await apiClient.get<{ cycles: HallOfFameCycle[] }>("/leaderboard/hall-of-fame", { params: { period } });
  return data.cycles;
}
