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

export type AnalyticsRange = 7 | 30 | 90;

interface PeriodTotal {
  current: number;
  previous: number;
}

interface DashboardPerson {
  id: string;
  name: string | null;
  email: string;
}

export interface DashboardAnalytics {
  range: { days: AnalyticsRange; from: string; to: string; timeZone: string };
  totals: { revenue: PeriodTotal; signups: PeriodTotal; attendance: PeriodTotal };
  trends: Record<"revenue" | "signups" | "attendance", { date: string; value: number }[]>;
  membershipStatus: {
    active: number;
    expiringSoon: number;
    expired: number;
    cancelled: number;
    expiringWindowDays: number;
  };
  activeByPlan: { planId: string; name: string; count: number }[];
  paymentStatus: Record<"PENDING" | "COMPLETED" | "FAILED" | "REFUNDED", number>;
  expiringSoon: { id: string; endDate: string; plan: { name: string }; user: DashboardPerson }[];
  recentPayments: {
    id: string;
    amount: number;
    currency: string;
    createdAt: string;
    plan: { name: string };
    user: DashboardPerson;
  }[];
}

export async function getDashboardAnalytics(days: AnalyticsRange) {
  const { data } = await apiClient.get<DashboardAnalytics>("/admin/dashboard/analytics", { params: { days } });
  return data;
}

export type Role = "ADMIN" | "TRAINER" | "USER";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

export interface PersonRef {
  id: string;
  name: string | null;
  email: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  accountStatus: AccountStatus;
  isEmailVerified: boolean;
  trainerId: string | null;
  trainer: PersonRef | null;
  createdAt: string;
}

export interface UserListResponse {
  items: AdminUserListItem[];
  pagination: { total: number; page: number; totalPages: number };
  // Counts per role / status for the current search, ignoring those filters.
  facets: { role: Partial<Record<Role, number>>; accountStatus: Partial<Record<AccountStatus, number>> };
}

export async function listUsers(params: { page?: number; limit?: number; search?: string; role?: Role; accountStatus?: AccountStatus }) {
  const { data } = await apiClient.get<UserListResponse>("/admin/users", { params });
  return data;
}

export interface AdminUserDetail extends AdminUserListItem {
  photoUrl: string | null;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  fitnessGoal: string | null;
  experienceLevel: string | null;
  activityLevel: string | null;
  gymName: string | null;
  xp: number;
  coins: number;
  updatedAt: string;
  signInMethod: "GOOGLE" | "PASSWORD";
  traineeCount: number;
  latestWeight: { weightKg: number; loggedAt: string } | null;
  activity: { workoutsCompleted30d: number; visits30d: number; mealsLogged7d: number };
  memberships: { id: string; status: string; startDate: string; endDate: string; plan: { id: string; name: string } }[];
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    gateway: string;
    invoiceNumber: string | null;
    createdAt: string;
    plan: { name: string };
  }[];
  attendances: { id: string; checkInAt: string; checkOutAt: string | null; durationMinutes: number | null; method: string }[];
  workoutPlanAssignments: { id: string; assignedAt: string; plan: { id: string; title: string } }[];
  dietPlanAssignments: { id: string; assignedAt: string; dietPlan: { id: string; title: string } }[];
}

export async function getUserDetail(id: string) {
  const { data } = await apiClient.get<{ user: AdminUserDetail }>(`/admin/users/${id}`);
  return data.user;
}

export async function updateUser(id: string, patch: { role?: Role; accountStatus?: AccountStatus; trainerId?: string | null }) {
  const { data } = await apiClient.patch<{ user: AdminUserListItem }>(`/admin/users/${id}`, patch);
  return data.user;
}

// Emails the member a reset code and signs them out; the admin never sets the password.
export async function sendPasswordReset(id: string) {
  const { data } = await apiClient.post<{ message: string; email: string }>(`/admin/users/${id}/reset-password`);
  return data;
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
  secondaryMuscles: string[];
  equipment: string[];
  caloriesBurnedEstimate: number | null;
  media: ExerciseMediaItem[];
  /** The flagged photo, else the first one. */
  thumbnailUrl: string | null;
  photoCount: number;
  videoCount: number;
  instructions: string[];
  commonMistakes: string[];
  coachTip: string | null;
  categories: { id: string; name: string; slug: string }[];
}

export interface ExerciseMediaItem {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  label: string | null;
  isThumbnail: boolean;
  provider: "upload" | "youtube" | "vimeo" | null;
}

export async function listExercises(params: { search?: string; page?: number; limit?: number }) {
  const { data } = await apiClient.get<{ items: AdminExercise[]; pagination: { total: number; page: number; totalPages: number } }>(
    "/exercises",
    { params }
  );
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

// null clears an optional field when editing.
export interface ExerciseInput {
  name: string;
  description?: string | null;
  difficulty: Difficulty;
  targetMuscle: string;
  secondaryMuscles?: string[];
  equipment?: string[];
  caloriesBurnedEstimate?: number | null;
  /** Replaces the whole list, in this order. */
  media?: { type: "IMAGE" | "VIDEO"; url: string; label?: string | null; isThumbnail?: boolean }[];
  instructions?: string[];
  commonMistakes?: string[];
  coachTip?: string | null;
  categoryIds?: string[];
}

export async function createExercise(input: ExerciseInput) {
  const { data } = await apiClient.post<{ exercise: AdminExercise }>("/admin/exercises", input);
  return data.exercise;
}

export async function updateExercise(id: string, input: ExerciseInput) {
  const { data } = await apiClient.patch<{ exercise: AdminExercise }>(`/admin/exercises/${id}`, input);
  return data.exercise;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<{ url: string }>("/uploads", form, { headers: { "Content-Type": "multipart/form-data" } });
  return data.url;
}

export async function uploadVideo(file: File, onProgress?: (percent: number) => void) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<{ url: string }>("/uploads/video", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
  });
  return data.url;
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

// Values are per 100 g.
export interface FoodInput {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number | null;
  sugarPer100g?: number | null;
  sodiumMgPer100g?: number | null;
}

export interface ManagedFood extends FoodInput {
  id: string;
  slug: string;
  updatedAt: string;
  _count: { nutritionLogs: number; mealItems: number };
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listManagedFoods(params: { search?: string; page?: number; limit?: number }) {
  const { data } = await apiClient.get<Paginated<ManagedFood>>("/admin/foods", { params });
  return data;
}

export async function createFood(input: FoodInput) {
  const { data } = await apiClient.post<{ food: ManagedFood }>("/admin/foods", input);
  return data.food;
}

export async function updateFood(id: string, input: Partial<FoodInput>) {
  const { data } = await apiClient.patch<{ food: ManagedFood }>(`/admin/foods/${id}`, input);
  return data.food;
}

export async function deleteFood(id: string) {
  await apiClient.delete(`/admin/foods/${id}`);
}

export type CategoryKind = "exercise" | "diet";

export interface ManagedCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  // "exercises" for exercise categories, "plans" for diet categories.
  _count: { exercises?: number; plans?: number };
}

const categoryPath = (kind: CategoryKind) => `/admin/${kind}-categories`;

export function categoryUsage(category: ManagedCategory) {
  return category._count.exercises ?? category._count.plans ?? 0;
}

export async function listManagedCategories(kind: CategoryKind) {
  const { data } = await apiClient.get<{ categories: ManagedCategory[] }>(categoryPath(kind));
  return data.categories;
}

export async function createCategory(kind: CategoryKind, input: { name: string; description?: string }) {
  const { data } = await apiClient.post<{ category: ManagedCategory }>(categoryPath(kind), input);
  return data.category;
}

export async function updateCategory(kind: CategoryKind, id: string, input: { name?: string; description?: string | null }) {
  const { data } = await apiClient.patch<{ category: ManagedCategory }>(`${categoryPath(kind)}/${id}`, input);
  return data.category;
}

export async function deleteCategory(kind: CategoryKind, id: string) {
  await apiClient.delete(`${categoryPath(kind)}/${id}`);
}

export async function listFoodsForAdmin(search?: string) {
  const { data } = await apiClient.get<{ items: AdminFood[] }>("/foods", { params: { search } });
  return data.items;
}
