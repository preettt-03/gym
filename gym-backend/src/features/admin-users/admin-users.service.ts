import { AccountStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';
import { getMemberInsights } from '@/features/admin-users/member-crm.service';

const LIST_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  role: true,
  accountStatus: true,
  isEmailVerified: true,
  trainerId: true,
  trainer: { select: { id: true, name: true, email: true } },
  createdAt: true,
} satisfies Prisma.UserSelect;

interface UserFilters {
  search?: string;
  role?: Role;
  accountStatus?: AccountStatus;
}

export async function listUsers(filters: UserFilters, pagination: PaginationParams) {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      // Numbers are stored as +91XXXXXXXXXX; match on the digits typed.
      ...(filters.search.replace(/\D/g, '').length >= 4 ? [{ phone: { contains: filters.search.replace(/\D/g, '') } }] : []),
    ];
  }
  if (filters.role) where.role = filters.role;
  if (filters.accountStatus) where.accountStatus = filters.accountStatus;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: LIST_SELECT,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  // Counts for the filter chips, independent of the active role/status filter.
  const base: Prisma.UserWhereInput = { deletedAt: null, ...(where.OR && { OR: where.OR }) };
  const [byRole, byStatus] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], where: base, _count: { _all: true } }),
    prisma.user.groupBy({ by: ['accountStatus'], where: base, _count: { _all: true } }),
  ]);

  return {
    items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
    facets: {
      role: Object.fromEntries(byRole.map((r) => [r.role, r._count._all])),
      accountStatus: Object.fromEntries(byStatus.map((r) => [r.accountStatus, r._count._all])),
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Everything an admin needs on one screen. Health notes (medical conditions,
// allergies) are deliberately left out — they aren't needed to manage an account.
export async function getUserDetail(id: string) {
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const since7 = new Date(Date.now() - 7 * DAY_MS);

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...LIST_SELECT,
      photoUrl: true,
      googleId: true,
      age: true,
      gender: true,
      heightCm: true,
      weightKg: true,
      targetWeightKg: true,
      fitnessGoal: true,
      experienceLevel: true,
      activityLevel: true,
      gymName: true,
      xp: true,
      coins: true,
      updatedAt: true,
      phone: true,
      isPhoneVerified: true,
      alternatePhone: true,
      dateOfBirth: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
      tags: true,
      lockerNumber: true,
      rfidTagId: true,
      ptSessionsTotal: true,
      ptSessionsUsed: true,
      _count: { select: { trainees: { where: { deletedAt: null } } } },
      memberships: {
        orderBy: { endDate: 'desc' },
        take: 5,
        select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { id: true, name: true } } },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, amount: true, currency: true, status: true, gateway: true, invoiceNumber: true, createdAt: true, plan: { select: { name: true } } },
      },
      attendances: {
        orderBy: { checkInAt: 'desc' },
        take: 5,
        select: { id: true, checkInAt: true, checkOutAt: true, durationMinutes: true, method: true },
      },
      workoutPlanAssignments: {
        where: { isActive: true },
        orderBy: { assignedAt: 'desc' },
        select: { id: true, assignedAt: true, plan: { select: { id: true, title: true } } },
      },
      dietPlanAssignments: {
        where: { isActive: true },
        orderBy: { assignedAt: 'desc' },
        select: { id: true, assignedAt: true, dietPlan: { select: { id: true, title: true } } },
      },
      weightLogs: { orderBy: { loggedAt: 'desc' }, take: 1, select: { weightKg: true, loggedAt: true } },
    },
  });
  if (!user) throw new AppError('User not found', 404);

  const [workoutsCompleted30d, visits30d, mealsLogged7d] = await Promise.all([
    prisma.workoutLog.count({ where: { userId: id, completedAt: { gte: since30 } } }),
    prisma.attendance.count({ where: { userId: id, checkInAt: { gte: since30 } } }),
    prisma.nutritionLog.count({ where: { userId: id, loggedAt: { gte: since7 } } }),
  ]);

  const insights = await getMemberInsights(id, user.createdAt);

  const { googleId, _count, weightLogs, ...rest } = user;
  return {
    ...rest,
    ...insights,
    signInMethod: googleId ? 'GOOGLE' : 'PASSWORD',
    traineeCount: _count.trainees,
    latestWeight: weightLogs[0] ?? null,
    activity: { workoutsCompleted30d, visits30d, mealsLogged7d },
  };
}

export async function updateUser(
  id: string,
  data: { role?: Role; accountStatus?: AccountStatus; trainerId?: string | null }
) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, _count: { select: { trainees: { where: { deletedAt: null } } } } },
  });
  if (!user) throw new AppError('User not found', 404);

  const nextRole = data.role ?? user.role;

  // Demoting a trainer would silently orphan their trainees.
  if (user.role === Role.TRAINER && nextRole !== Role.TRAINER && user._count.trainees > 0) {
    const n = user._count.trainees;
    throw new AppError(`This trainer still coaches ${n} member${n === 1 ? '' : 's'}. Reassign them first.`, 409);
  }

  if (data.trainerId) {
    if (nextRole !== Role.USER) throw new AppError('Only members can be assigned a trainer', 422);
    if (data.trainerId === id) throw new AppError("A member can't be their own trainer", 422);
    const trainer = await prisma.user.findFirst({
      where: { id: data.trainerId, deletedAt: null },
      select: { role: true, accountStatus: true },
    });
    if (!trainer || trainer.role !== Role.TRAINER) throw new AppError('The selected trainer was not found', 422);
    if (trainer.accountStatus !== AccountStatus.ACTIVE) throw new AppError('The selected trainer account is not active', 422);
  }

  // Promoting a member to staff ends their own trainer assignment.
  const extra = nextRole !== Role.USER && data.trainerId === undefined ? { trainerId: null } : {};
  const updated = await prisma.user.update({ where: { id }, data: { ...data, ...extra }, select: LIST_SELECT });

  // Suspending/banning revokes standing sessions so the account can't keep using an
  // already-issued refresh token to mint new access tokens. A role change does the
  // same, because the role is baked into issued tokens.
  const roleChanged = data.role !== undefined && data.role !== user.role;
  if (roleChanged || (data.accountStatus && data.accountStatus !== 'ACTIVE')) {
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return updated;
}

export async function deleteUser(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { _count: { select: { trainees: { where: { deletedAt: null } } } } },
  });
  if (!user) throw new AppError('User not found', 404);
  if (user._count.trainees > 0) {
    const n = user._count.trainees;
    throw new AppError(`This trainer still coaches ${n} member${n === 1 ? '' : 's'}. Reassign them first.`, 409);
  }

  await prisma.$transaction([
    // Free the number (it's a login), the locker and the key fob for whoever comes next.
    prisma.user.update({ where: { id }, data: { deletedAt: new Date(), phone: null, isPhoneVerified: false, lockerNumber: null, rfidTagId: null } }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}
