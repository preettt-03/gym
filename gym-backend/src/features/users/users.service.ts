import fs from 'node:fs/promises';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { env } from '@/config/env';
import { UPLOAD_DIR } from '@/lib/upload';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { yearsSince } from '@/features/users/users.schemas';
import {
  bmiCategory,
  calculateBmi,
  calculateBmr,
  calculateCalorieNeeds,
  calculateWaterIntakeLiters,
} from '@/lib/health-calculators';
import { getMyStreak } from '@/features/streaks/streaks.service';
import { listActiveMissionsForUser } from '@/features/missions/missions.service';
import { getCurrentStatus } from '@/features/attendance/attendance.service';
import { getTodaysWorkoutDay, listMyPlans } from '@/features/workout-plans/workout-plans.service';
import { getActiveDietPlan } from '@/features/diet-plans/diet-plans.service';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  photoUrl: true,
  role: true,
  isEmailVerified: true,
  age: true,
  gender: true,
  heightCm: true,
  weightKg: true,
  targetWeightKg: true,
  fitnessGoal: true,
  experienceLevel: true,
  activityLevel: true,
  gymName: true,
  gymBranch: true,
  medicalConditions: true,
  allergies: true,
  coins: true,
  xp: true,
  phone: true,
  isPhoneVerified: true,
  alternatePhone: true,
  dateOfBirth: true,
  bloodGroup: true,
  injuries: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  googleId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
  if (!user) throw new AppError('User not found', 404);
  return present(user);
}

export async function updateProfile(userId: string, input: Prisma.UserUpdateInput & { dateOfBirth?: string | null }) {
  const { dateOfBirth, ...data } = input;
  // A date of birth keeps `age` (used by every calculator) correct automatically.
  const dob = dateOfBirth === undefined ? {} : dateOfBirth === null ? { dateOfBirth: null } : { dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`), age: yearsSince(dateOfBirth) };
  const user = await prisma.user.update({ where: { id: userId }, data: { ...data, ...dob }, select: PROFILE_SELECT });
  return present(user);
}

// googleId is only used to tell the app how the member signs in.
function present<T extends { googleId: string | null }>({ googleId, ...user }: T) {
  return { ...user, hasGoogle: Boolean(googleId) };
}

// Only files we stored ourselves are deleted (a Google sign-in photo is an external URL).
async function removeOwnUpload(url: string | null) {
  const prefix = `${env.PUBLIC_URL}/uploads/`;
  if (!url?.startsWith(prefix)) return;
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(url.slice(prefix.length)))).catch(() => undefined);
}

// Profile photos are public on purpose (they appear next to chat messages), so
// they live in the regular uploads folder rather than private storage.
export async function setProfilePhoto(userId: string, filename: string) {
  const { photoUrl: previous } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { photoUrl: true } });
  const user = await prisma.user.update({ where: { id: userId }, data: { photoUrl: `${env.PUBLIC_URL}/uploads/${filename}` }, select: PROFILE_SELECT });
  await removeOwnUpload(previous);
  return user;
}

export async function removeProfilePhoto(userId: string) {
  const { photoUrl: previous } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { photoUrl: true } });
  const user = await prisma.user.update({ where: { id: userId }, data: { photoUrl: null }, select: PROFILE_SELECT });
  await removeOwnUpload(previous);
  return user;
}

export async function logWeight(userId: string, weightKg: number, loggedAt?: string) {
  const [log] = await prisma.$transaction([
    prisma.weightLog.create({
      data: { userId, weightKg, loggedAt: loggedAt ? new Date(loggedAt) : undefined },
    }),
    prisma.user.update({ where: { id: userId }, data: { weightKg } }),
  ]);
  return log;
}

export async function listWeightLogs(userId: string, limit = 90) {
  return prisma.weightLog.findMany({ where: { userId }, orderBy: { loggedAt: 'desc' }, take: limit });
}

export async function getDashboard(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const hasBmrInputs = Boolean(user.weightKg && user.heightCm && user.age);
  const bmi = user.weightKg && user.heightCm ? calculateBmi(user.weightKg, user.heightCm) : null;
  const bmr = hasBmrInputs ? calculateBmr(user.weightKg!, user.heightCm!, user.age!, user.gender) : null;
  const calorieNeeds = bmr !== null ? calculateCalorieNeeds(bmr, user.activityLevel) : null;
  const waterIntakeLiters = user.weightKg ? calculateWaterIntakeLiters(user.weightKg) : null;

  const [streak, missions, attendanceStatus, plans, todayWorkout, todayDiet] = await Promise.all([
    getMyStreak(userId),
    listActiveMissionsForUser(userId),
    getCurrentStatus(userId),
    listMyPlans(userId),
    getTodaysWorkoutDay(userId),
    getActiveDietPlan(userId),
  ]);

  const activePlan = plans.assignedPlans[0] ?? plans.ownedPlans[0] ?? null;

  return {
    profile: {
      currentWeightKg: user.weightKg,
      heightCm: user.heightCm,
      targetWeightKg: user.targetWeightKg,
      fitnessGoal: user.fitnessGoal,
    },
    metrics: {
      bmi,
      bmiCategory: bmi !== null ? bmiCategory(bmi) : null,
      bmr,
      calorieNeeds,
      waterIntakeLiters,
    },
    streak: { currentStreak: streak.currentStreak, longestStreak: streak.longestStreak },
    activePlan,
    gymAttendanceStatus: attendanceStatus,
    dailyMissionProgress: {
      total: missions.length,
      completed: missions.filter((m) => m.progress.isCompleted).length,
      missions,
    },
    today: {
      workout: todayWorkout,
      diet: todayDiet,
    },
  };
}
