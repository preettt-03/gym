import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { getDashboard } from '@/features/users/users.service';
import { assignPlan } from '@/features/workout-plans/workout-plans.service';
import { assignDietPlan } from '@/features/diet-plans/diet-plans.service';
import { createNotification } from '@/features/notifications/notifications.service';

const TRAINEE_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  photoUrl: true,
  fitnessGoal: true,
  experienceLevel: true,
  weightKg: true,
  targetWeightKg: true,
  streak: { select: { currentStreak: true, longestStreak: true } },
} satisfies Prisma.UserSelect;

async function assertOwnsTrainee(trainerId: string, traineeId: string) {
  const trainee = await prisma.user.findFirst({
    where: { id: traineeId, trainerId, deletedAt: null },
  });
  if (!trainee) throw new AppError('Trainee not found or not assigned to you', 404);
  return trainee;
}

export async function listTrainees(trainerId: string) {
  return prisma.user.findMany({
    where: { trainerId, deletedAt: null },
    select: TRAINEE_LIST_SELECT,
    orderBy: { name: 'asc' },
  });
}

export async function getTraineeOverview(trainerId: string, traineeId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  return getDashboard(traineeId);
}

export async function getTraineeProfile(trainerId: string, traineeId: string) {
  const trainee = await assertOwnsTrainee(trainerId, traineeId);
  const { passwordHash, ...profile } = trainee;
  return profile;
}

export async function listTraineeWorkoutLogs(trainerId: string, traineeId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  return prisma.workoutLog.findMany({
    where: { userId: traineeId },
    orderBy: { date: 'desc' },
    take: 20,
    include: { plan: true },
  });
}

export async function listTraineeWeightLogs(trainerId: string, traineeId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  return prisma.weightLog.findMany({
    where: { userId: traineeId },
    orderBy: { loggedAt: 'desc' },
    take: 30,
  });
}

export async function listTraineeAttendance(trainerId: string, traineeId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  return prisma.attendance.findMany({
    where: { userId: traineeId },
    orderBy: { checkInAt: 'desc' },
    take: 20,
  });
}

export async function assignWorkoutPlanToTrainee(trainerId: string, traineeId: string, planId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  await assignPlan(planId, [traineeId]);
}

export async function assignDietPlanToTrainee(trainerId: string, traineeId: string, planId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  await assignDietPlan(planId, [traineeId]);
}

export async function sendNoteToTrainee(trainerId: string, traineeId: string, title: string, body?: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  return createNotification(traineeId, NotificationType.SYSTEM, title, body);
}
