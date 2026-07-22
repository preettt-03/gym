import { apiClient } from "@/lib/api-client";
import type { AdminUser } from "@/stores/auth-store";

export interface AuthResponse {
  user: AdminUser;
  accessToken: string;
}

export async function loginAdmin(input: { email: string; password: string }) {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", input);
  return data;
}

export interface DashboardKpis {
  totalUsers: number;
  newUsersLast7Days: number;
  totalExercises: number;
  totalWorkoutPlans: number;
  totalDietPlans: number;
  activeMemberships: number;
  attendanceToday: number;
  totalRevenue: number;
}

export async function getAdminDashboard() {
  const { data } = await apiClient.get<DashboardKpis>("/admin/dashboard");
  return data;
}

export type Role = "ADMIN" | "TRAINER" | "USER";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  accountStatus: AccountStatus;
  isEmailVerified: boolean;
  trainerId: string | null;
  createdAt: string;
}

export async function listUsers(params: { page?: number; search?: string; role?: Role; accountStatus?: AccountStatus }) {
  const { data } = await apiClient.get<{
    items: AdminUserListItem[];
    pagination: { total: number; page: number; totalPages: number };
  }>("/admin/users", { params });
  return data;
}

export async function updateUser(id: string, patch: { role?: Role; accountStatus?: AccountStatus }) {
  const { data } = await apiClient.patch<{ user: AdminUserListItem }>(`/admin/users/${id}`, patch);
  return data.user;
}

export async function deleteUser(id: string) {
  await apiClient.delete(`/admin/users/${id}`);
}

export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface AdminExercise {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  difficulty: Difficulty;
  targetMuscle: string;
  equipment: string[];
  caloriesBurnedEstimate: number | null;
  categories: { id: string; name: string; slug: string }[];
}

export async function listExercises(params: { search?: string }) {
  const { data } = await apiClient.get<{ items: AdminExercise[]; pagination: { total: number } }>("/exercises", {
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

export interface CreateExerciseInput {
  name: string;
  description?: string;
  difficulty: Difficulty;
  targetMuscle: string;
  equipment?: string[];
  caloriesBurnedEstimate?: number;
  categoryIds?: string[];
}

export async function createExercise(input: CreateExerciseInput) {
  const { data } = await apiClient.post<{ exercise: AdminExercise }>("/admin/exercises", input);
  return data.exercise;
}

export async function deleteExercise(id: string) {
  await apiClient.delete(`/admin/exercises/${id}`);
}

export interface AdminChatChannel {
  id: string;
  name: string | null;
  createdAt: string;
  members: { user: { id: string; name: string | null; email: string } }[];
}

export async function listChannels() {
  const { data } = await apiClient.get<{ channels: AdminChatChannel[] }>("/admin/chat/channels");
  return data.channels;
}

export async function createChannel(name: string) {
  const { data } = await apiClient.post<{ room: AdminChatChannel }>("/admin/chat/channels", { name });
  return data.room;
}

export async function addChannelMember(roomId: string, userId: string) {
  await apiClient.post(`/admin/chat/channels/${roomId}/members`, { userIds: [userId] });
}

export async function removeChannelMember(roomId: string, userId: string) {
  await apiClient.delete(`/admin/chat/channels/${roomId}/members/${userId}`);
}

export async function broadcastNotification(input: { title: string; body?: string }) {
  const { data } = await apiClient.post<{ notified: number }>("/admin/notifications/broadcast", input);
  return data;
}

// --- Membership plans ---

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  price: number;
  discountPercent: number | null;
  benefits: string[];
  isActive: boolean;
}

export async function listAdminMembershipPlans() {
  const { data } = await apiClient.get<{ plans: MembershipPlan[] }>("/admin/membership-plans");
  return data.plans;
}

export interface CreateMembershipPlanInput {
  name: string;
  description?: string;
  durationDays: number;
  price: number;
  discountPercent?: number;
  benefits?: string[];
}

export async function createMembershipPlan(input: CreateMembershipPlanInput) {
  const { data } = await apiClient.post<{ plan: MembershipPlan }>("/admin/membership-plans", input);
  return data.plan;
}

export async function deleteMembershipPlan(id: string) {
  await apiClient.delete(`/admin/membership-plans/${id}`);
}

// --- Attendance ---

export interface AdminAttendanceItem {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMinutes: number | null;
  method: string;
  user: { id: string; name: string | null; email: string };
}

export async function listAllAttendance() {
  const { data } = await apiClient.get<{ items: AdminAttendanceItem[]; pagination: { total: number } }>(
    "/admin/attendance"
  );
  return data;
}

export async function adminCheckIn(userId: string) {
  const { data } = await apiClient.post("/admin/attendance/check-in", { userId });
  return data;
}

// --- Missions & Badges ---

export interface AdminBadge {
  id: string;
  name: string;
  description: string | null;
  streakThresholdDays: number | null;
}

export async function listBadges() {
  const { data } = await apiClient.get<{ badges: AdminBadge[] }>("/badges");
  return data.badges;
}

export async function createBadge(input: { name: string; description?: string; streakThresholdDays?: number }) {
  const { data } = await apiClient.post<{ badge: AdminBadge }>("/admin/badges", input);
  return data.badge;
}

export async function deleteBadge(id: string) {
  await apiClient.delete(`/admin/badges/${id}`);
}

export type MissionConditionType =
  | "COMPLETE_WORKOUT"
  | "DRINK_WATER"
  | "BURN_CALORIES"
  | "HIT_PROTEIN_GOAL"
  | "WALK_STEPS"
  | "CUSTOM";

export interface AdminMission {
  id: string;
  title: string;
  description: string | null;
  conditionType: MissionConditionType;
  targetValue: number;
  rewardCoins: number;
  rewardXp: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export async function listAdminMissions() {
  const { data } = await apiClient.get<{ missions: AdminMission[] }>("/admin/missions");
  return data.missions;
}

export interface CreateMissionInput {
  title: string;
  description?: string;
  conditionType: MissionConditionType;
  targetValue: number;
  rewardCoins: number;
  rewardXp: number;
  startDate: string;
  endDate: string;
}

export async function createMission(input: CreateMissionInput) {
  const { data } = await apiClient.post<{ mission: AdminMission }>("/admin/missions", input);
  return data.mission;
}

export async function deleteMission(id: string) {
  await apiClient.delete(`/admin/missions/${id}`);
}

// --- Workout plans ---

export interface AdminWorkoutPlan {
  id: string;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  estimatedCalories: number | null;
  estimatedMinutes: number | null;
  assignments?: { userId: string }[];
}

export async function listAdminWorkoutPlans() {
  const { data } = await apiClient.get<{ plans: AdminWorkoutPlan[] }>("/admin/workout-plans");
  return data.plans;
}

export interface CreateWorkoutPlanInput {
  title: string;
  description?: string;
  difficulty: Difficulty;
  estimatedCalories?: number;
  estimatedMinutes?: number;
  days: {
    weekNumber: number;
    dayNumber: number;
    title?: string;
    isRestDay: boolean;
    exercises: { exerciseId: string; targetSets?: number; targetReps?: number }[];
  }[];
}

export async function createWorkoutPlan(input: CreateWorkoutPlanInput) {
  const { data } = await apiClient.post<{ plan: AdminWorkoutPlan }>("/admin/workout-plans", input);
  return data.plan;
}

export async function deleteWorkoutPlan(id: string) {
  await apiClient.delete(`/admin/workout-plans/${id}`);
}

export async function assignWorkoutPlan(planId: string, userIds: string[]) {
  await apiClient.post(`/admin/workout-plans/${planId}/assign`, { userIds });
}

// --- Diet plans ---

export interface AdminDietPlan {
  id: string;
  title: string;
  description: string | null;
  estimatedCalories: number | null;
}

export async function listAdminDietPlans() {
  const { data } = await apiClient.get<{ plans: AdminDietPlan[] }>("/admin/diet-plans");
  return data.plans;
}

export interface CreateDietPlanInput {
  title: string;
  description?: string;
  estimatedCalories?: number;
  meals: {
    mealType: string;
    title?: string;
    items: { foodId: string; quantityGrams: number }[];
  }[];
}

export async function createDietPlan(input: CreateDietPlanInput) {
  const { data } = await apiClient.post<{ plan: AdminDietPlan }>("/admin/diet-plans", input);
  return data.plan;
}

export async function deleteDietPlan(id: string) {
  await apiClient.delete(`/admin/diet-plans/${id}`);
}

export async function assignDietPlan(planId: string, userIds: string[]) {
  await apiClient.post(`/admin/diet-plans/${planId}/assign`, { userIds });
}

export interface AdminFood {
  id: string;
  name: string;
}

export async function listFoodsForAdmin(search?: string) {
  const { data } = await apiClient.get<{ items: AdminFood[] }>("/foods", { params: { search } });
  return data.items;
}
