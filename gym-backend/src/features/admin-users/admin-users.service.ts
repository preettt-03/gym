import bcrypt from 'bcrypt';
import { AccountStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';

const LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  accountStatus: true,
  isEmailVerified: true,
  trainerId: true,
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

export async function getUserDetail(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      memberships: { orderBy: { endDate: 'desc' }, take: 1, include: { plan: true } },
      attendances: { orderBy: { checkInAt: 'desc' }, take: 5 },
      payments: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!user) throw new AppError('User not found', 404);

  const { passwordHash, ...rest } = user;
  return rest;
}

export async function updateUser(
  id: string,
  data: { role?: Role; accountStatus?: AccountStatus; trainerId?: string | null }
) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('User not found', 404);

  const updated = await prisma.user.update({ where: { id }, data, select: LIST_SELECT });

  // Suspending/banning revokes standing sessions so the account can't keep using an
  // already-issued refresh token to mint new access tokens.
  if (data.accountStatus && data.accountStatus !== 'ACTIVE') {
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return updated;
}

export async function deleteUser(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('User not found', 404);

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function resetUserPassword(id: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new AppError('User not found', 404);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}
