import { MembershipStatus, NotificationType, Prisma } from '@prisma/client';
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

const DAY_MS = 24 * 60 * 60 * 1000;

// Trainee roster with the signals a coach scans first: last visit, recent
// workouts, membership state and latest weigh-in. Batched so it's a fixed
// number of queries regardless of roster size.
export async function listTrainees(trainerId: string) {
  const trainees = await prisma.user.findMany({
    where: { trainerId, deletedAt: null },
    select: TRAINEE_LIST_SELECT,
    orderBy: { name: 'asc' },
  });
  const ids = trainees.map((t) => t.id);
  if (!ids.length) return [];

  const now = new Date();
  const [lastVisits, workouts7d, memberships, weights] = await Promise.all([
    prisma.attendance.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { checkInAt: true } }),
    prisma.workoutLog.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, completedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      _count: { _all: true },
    }),
    prisma.membership.findMany({
      where: { userId: { in: ids }, status: MembershipStatus.ACTIVE, endDate: { gte: now } },
      orderBy: { endDate: 'desc' },
      select: { userId: true, endDate: true, plan: { select: { name: true } } },
    }),
    prisma.weightLog.findMany({
      where: { userId: { in: ids } },
      orderBy: { loggedAt: 'desc' },
      distinct: ['userId'],
      select: { userId: true, weightKg: true, loggedAt: true },
    }),
  ]);

  const lastVisit = new Map(lastVisits.map((v) => [v.userId, v._max.checkInAt]));
  const workouts = new Map(workouts7d.map((w) => [w.userId, w._count._all]));
  const membership = new Map<string, (typeof memberships)[number]>();
  for (const m of memberships) if (!membership.has(m.userId)) membership.set(m.userId, m);
  const weight = new Map(weights.map((w) => [w.userId, w]));

  return trainees.map((t) => ({
    ...t,
    lastVisitAt: lastVisit.get(t.id) ?? null,
    workoutsLast7Days: workouts.get(t.id) ?? 0,
    membership: membership.has(t.id)
      ? { planName: membership.get(t.id)!.plan.name, endDate: membership.get(t.id)!.endDate }
      : null,
    latestWeight: weight.has(t.id) ? { weightKg: weight.get(t.id)!.weightKg, loggedAt: weight.get(t.id)!.loggedAt } : null,
  }));
}

export async function getTraineeOverview(trainerId: string, traineeId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  return getDashboard(traineeId);
}

export async function getTraineeProfile(trainerId: string, traineeId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  // Coaching-relevant fields only. Medical conditions and allergies are
  // included because a trainer needs them to program safely.
  return prisma.user.findUniqueOrThrow({
    where: { id: traineeId },
    select: {
      id: true,
      name: true,
      email: true,
      photoUrl: true,
      age: true,
      gender: true,
      heightCm: true,
      weightKg: true,
      targetWeightKg: true,
      fitnessGoal: true,
      experienceLevel: true,
      activityLevel: true,
      medicalConditions: true,
      injuries: true,
      bloodGroup: true,
      allergies: true,
      createdAt: true,
    },
  });
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

// --- Private notes (never shown to the trainee) ---

const NOTE_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TrainerNoteSelect;

export async function listPrivateNotes(trainerId: string, traineeId: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  return prisma.trainerNote.findMany({ where: { traineeId }, orderBy: { createdAt: 'desc' }, select: NOTE_SELECT });
}

export async function addPrivateNote(trainerId: string, traineeId: string, body: string) {
  await assertOwnsTrainee(trainerId, traineeId);
  return prisma.trainerNote.create({ data: { authorId: trainerId, traineeId, body }, select: NOTE_SELECT });
}

// Only the author may change a note, and only while they still coach the trainee.
async function assertOwnNote(trainerId: string, noteId: string) {
  const note = await prisma.trainerNote.findUnique({ where: { id: noteId }, select: { authorId: true, traineeId: true } });
  if (!note || note.authorId !== trainerId) throw new AppError('Note not found', 404);
  await assertOwnsTrainee(trainerId, note.traineeId);
}

export async function updatePrivateNote(trainerId: string, noteId: string, body: string) {
  await assertOwnNote(trainerId, noteId);
  return prisma.trainerNote.update({ where: { id: noteId }, data: { body }, select: NOTE_SELECT });
}

export async function deletePrivateNote(trainerId: string, noteId: string) {
  await assertOwnNote(trainerId, noteId);
  await prisma.trainerNote.delete({ where: { id: noteId } });
}
