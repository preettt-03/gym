import { PlanSource, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';
import { ExerciseLogEntry, PlanInput, PlanUpdateInput } from '@/features/workout-plans/workout-plans.schemas';
import { recordDailyActivity } from '@/features/streaks/streaks.service';

const planInclude = {
  days: {
    orderBy: [{ weekNumber: 'asc' }, { dayNumber: 'asc' }],
    include: {
      exercises: {
        orderBy: { order: 'asc' },
        include: { exercise: true },
      },
    },
  },
} satisfies Prisma.WorkoutPlanInclude;

function daysCreateData(days: PlanInput['days']) {
  return days.map((day) => ({
    weekNumber: day.weekNumber,
    dayNumber: day.dayNumber,
    title: day.title,
    isRestDay: day.isRestDay,
    exercises: {
      create: day.exercises.map((ex, idx) => ({
        exerciseId: ex.exerciseId,
        order: ex.order ?? idx,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeightKg: ex.targetWeightKg,
        targetDurationSeconds: ex.targetDurationSeconds,
        targetDistanceMeters: ex.targetDistanceMeters,
        notes: ex.notes,
      })),
    },
  }));
}

// --- Admin ---

export async function createAdminPlan(adminId: string, input: PlanInput) {
  return prisma.workoutPlan.create({
    data: {
      title: input.title,
      description: input.description,
      difficulty: input.difficulty,
      estimatedCalories: input.estimatedCalories,
      estimatedMinutes: input.estimatedMinutes,
      source: PlanSource.ADMIN,
      createdByAdminId: adminId,
      days: { create: daysCreateData(input.days) },
    },
    include: planInclude,
  });
}

export async function listAdminPlans() {
  return prisma.workoutPlan.findMany({
    where: { source: PlanSource.ADMIN, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { assignments: true },
  });
}

export async function getAdminPlan(id: string) {
  const plan = await prisma.workoutPlan.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...planInclude,
      assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!plan) throw new AppError('Plan not found', 404);
  return plan;
}

export async function updatePlanMeta(id: string, data: PlanUpdateInput) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id } });
  if (!plan || plan.deletedAt) throw new AppError('Plan not found', 404);

  const { days, ...meta } = data;

  if (days) {
    await prisma.workoutPlanDay.deleteMany({ where: { planId: id } });
  }

  return prisma.workoutPlan.update({
    where: { id },
    data: {
      ...meta,
      days: days ? { create: daysCreateData(days) } : undefined,
    },
    include: planInclude,
  });
}

export async function deletePlan(id: string) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id } });
  if (!plan || plan.deletedAt) throw new AppError('Plan not found', 404);
  await prisma.workoutPlan.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function assignPlan(planId: string, userIds: string[]) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.deletedAt || plan.source !== PlanSource.ADMIN) {
    throw new AppError('Admin plan not found', 404);
  }

  await prisma.$transaction(
    userIds.map((userId) =>
      prisma.workoutPlanAssignment.upsert({
        where: { planId_userId: { planId, userId } },
        update: { isActive: true },
        create: { planId, userId },
      })
    )
  );
}

export async function unassignPlan(planId: string, userId: string) {
  await prisma.workoutPlanAssignment.updateMany({
    where: { planId, userId },
    data: { isActive: false },
  });
}

// --- User-facing ---

async function assertUserPlanAccess(planId: string, userId: string) {
  const plan = await prisma.workoutPlan.findFirst({ where: { id: planId, deletedAt: null } });
  if (!plan) throw new AppError('Plan not found', 404);

  if (plan.source === PlanSource.USER) {
    if (plan.ownerId !== userId) throw new AppError('Forbidden', 403);
    return plan;
  }

  const assignment = await prisma.workoutPlanAssignment.findUnique({
    where: { planId_userId: { planId, userId } },
  });
  if (!assignment || !assignment.isActive) throw new AppError('Forbidden', 403);
  return plan;
}

type PlanWithDays = Prisma.WorkoutPlanGetPayload<{ include: typeof planInclude }>;

function applyOverrides(
  plan: PlanWithDays,
  overridesByPlanExerciseId: Map<string, Prisma.UserExerciseOverrideGetPayload<{ include: { replacementExercise: true } }>>
) {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((planExercise) => {
        const override = overridesByPlanExerciseId.get(planExercise.id);
        if (!override) return { ...planExercise, isSwapped: false };
        return {
          ...planExercise,
          exercise: override.replacementExercise,
          originalExercise: planExercise.exercise,
          isSwapped: true,
        };
      }),
    })),
  };
}

export async function listMyPlans(userId: string) {
  const [owned, assignments] = await Promise.all([
    prisma.workoutPlan.findMany({
      where: { source: PlanSource.USER, ownerId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workoutPlanAssignment.findMany({
      where: { userId, isActive: true, plan: { deletedAt: null } },
      include: { plan: true },
      orderBy: { assignedAt: 'desc' },
    }),
  ]);

  return {
    ownedPlans: owned,
    assignedPlans: assignments.map((a) => a.plan),
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A plan's days aren't tied to real calendar weekdays (weekNumber/dayNumber
// just define a cycle), so "today's workout" is: how many days has the user
// had this plan active, mod the plan's total day count, giving a repeating
// cycle starting from the day the plan was assigned (or created, if it's a
// self-built plan with no assignment row).
export async function getTodaysWorkoutDay(userId: string) {
  const [ownedPlan, assignment] = await Promise.all([
    prisma.workoutPlan.findFirst({
      where: { source: PlanSource.USER, ownerId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.workoutPlanAssignment.findFirst({
      where: { userId, isActive: true, plan: { deletedAt: null } },
      include: { plan: true },
      orderBy: { assignedAt: 'desc' },
    }),
  ]);

  const active = assignment ? { plan: assignment.plan, startedAt: assignment.assignedAt } : ownedPlan ? { plan: ownedPlan, startedAt: ownedPlan.createdAt } : null;
  if (!active) return null;

  const days = await prisma.workoutPlanDay.findMany({
    where: { planId: active.plan.id },
    orderBy: [{ weekNumber: 'asc' }, { dayNumber: 'asc' }],
    include: { exercises: { orderBy: { order: 'asc' }, include: { exercise: true } } },
  });
  if (days.length === 0) return null;

  const daysSinceStart = Math.floor((Date.now() - active.startedAt.getTime()) / MS_PER_DAY);
  const cycleIndex = ((daysSinceStart % days.length) + days.length) % days.length;

  return { planId: active.plan.id, planTitle: active.plan.title, day: days[cycleIndex] };
}

export async function createUserPlan(userId: string, input: PlanInput) {
  return prisma.workoutPlan.create({
    data: {
      title: input.title,
      description: input.description,
      difficulty: input.difficulty,
      estimatedCalories: input.estimatedCalories,
      estimatedMinutes: input.estimatedMinutes,
      source: PlanSource.USER,
      ownerId: userId,
      days: { create: daysCreateData(input.days) },
    },
    include: planInclude,
  });
}

export async function getMyPlan(planId: string, userId: string) {
  await assertUserPlanAccess(planId, userId);

  const plan = await prisma.workoutPlan.findUnique({ where: { id: planId }, include: planInclude });
  if (!plan) throw new AppError('Plan not found', 404);

  const planExerciseIds = plan.days.flatMap((d) => d.exercises.map((e) => e.id));
  const overrides = await prisma.userExerciseOverride.findMany({
    where: { userId, planExerciseId: { in: planExerciseIds } },
    include: { replacementExercise: true },
  });
  const overridesByPlanExerciseId = new Map(overrides.map((o) => [o.planExerciseId, o]));

  return applyOverrides(plan, overridesByPlanExerciseId);
}

export async function updateMyPlan(planId: string, userId: string, data: PlanUpdateInput) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.deletedAt || plan.source !== PlanSource.USER || plan.ownerId !== userId) {
    throw new AppError('Plan not found', 404);
  }
  return updatePlanMeta(planId, data);
}

export async function deleteMyPlan(planId: string, userId: string) {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.deletedAt || plan.source !== PlanSource.USER || plan.ownerId !== userId) {
    throw new AppError('Plan not found', 404);
  }
  await deletePlan(planId);
}

export async function swapExercise(userId: string, planExerciseId: string, replacementExerciseId: string) {
  const planExercise = await prisma.workoutPlanExercise.findUnique({
    where: { id: planExerciseId },
    include: { day: { include: { plan: true } } },
  });
  if (!planExercise) throw new AppError('Plan exercise not found', 404);

  await assertUserPlanAccess(planExercise.day.plan.id, userId);

  const replacement = await prisma.exercise.findFirst({ where: { id: replacementExerciseId, deletedAt: null } });
  if (!replacement) throw new AppError('Replacement exercise not found', 404);

  return prisma.userExerciseOverride.upsert({
    where: { userId_planExerciseId: { userId, planExerciseId } },
    update: { replacementExerciseId },
    create: { userId, planExerciseId, replacementExerciseId },
    include: { replacementExercise: true },
  });
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function completeDay(
  userId: string,
  dayId: string,
  notes: string | undefined,
  exerciseLogs: ExerciseLogEntry[]
) {
  const day = await prisma.workoutPlanDay.findUnique({ where: { id: dayId }, include: { plan: true } });
  if (!day) throw new AppError('Day not found', 404);

  await assertUserPlanAccess(day.plan.id, userId);

  const today = new Date();
  const existing = await prisma.workoutLog.findFirst({
    where: { userId, dayId, date: { gte: startOfDay(today), lte: endOfDay(today) } },
  });

  const log = existing
    ? await prisma.workoutLog.update({
        where: { id: existing.id },
        data: { notes: notes ?? existing.notes, completedAt: new Date() },
      })
    : await prisma.workoutLog.create({
        data: { userId, planId: day.planId, dayId, notes, completedAt: new Date() },
      });

  if (exerciseLogs.length) {
    await prisma.workoutExerciseLog.createMany({
      data: exerciseLogs.map((entry) => ({ workoutLogId: log.id, ...entry })),
    });
  }

  await recordDailyActivity(userId);

  return prisma.workoutLog.findUnique({
    where: { id: log.id },
    include: { exerciseLogs: { include: { exercise: true } } },
  });
}

export async function listMyWorkoutLogs(userId: string, pagination: PaginationParams, from?: string, to?: string) {
  const where: Prisma.WorkoutLogWhereInput = { userId };
  if (from || to) {
    where.date = {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    };
  }

  const [items, total] = await Promise.all([
    prisma.workoutLog.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { date: 'desc' },
      include: { exerciseLogs: { include: { exercise: true } }, day: true, plan: true },
    }),
    prisma.workoutLog.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function getWorkoutLog(userId: string, id: string) {
  const log = await prisma.workoutLog.findFirst({
    where: { id, userId },
    include: { exerciseLogs: { include: { exercise: true } }, day: true, plan: true },
  });
  if (!log) throw new AppError('Workout log not found', 404);
  return log;
}
