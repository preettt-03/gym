import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';

interface BadgeInput {
  name: string;
  description?: string;
  iconUrl?: string;
  streakThresholdDays?: number;
}

export async function listBadges() {
  return prisma.badge.findMany({ orderBy: { name: 'asc' } });
}

export async function createBadge(input: BadgeInput) {
  return prisma.badge.create({ data: input });
}

export async function updateBadge(id: string, data: Partial<BadgeInput>) {
  const badge = await prisma.badge.findUnique({ where: { id } });
  if (!badge) throw new AppError('Badge not found', 404);
  return prisma.badge.update({ where: { id }, data });
}

export async function deleteBadge(id: string) {
  const badge = await prisma.badge.findUnique({ where: { id } });
  if (!badge) throw new AppError('Badge not found', 404);
  await prisma.badge.delete({ where: { id } });
}

export async function listMyBadges(userId: string) {
  return prisma.userBadge.findMany({ where: { userId }, include: { badge: true }, orderBy: { awardedAt: 'desc' } });
}
