import { AttendanceMethod, MembershipStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';
import { getEffectiveMembership } from '@/features/memberships/memberships.service';

async function assertNoOpenCheckIn(userId: string) {
  const open = await prisma.attendance.findFirst({ where: { userId, checkOutAt: null } });
  if (open) throw new AppError('You already have an open check-in. Check out first.', 409);
}

// Server-side membership validation: an expired/inactive membership blocks check-in,
// regardless of what the client (QR scan, admin UI) thinks the status is.
export async function checkIn(userId: string, method: AttendanceMethod = AttendanceMethod.QR, approvedByAdminId?: string) {
  const membership = await getEffectiveMembership(userId);
  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new AppError('Active membership required to check in', 403);
  }

  await assertNoOpenCheckIn(userId);

  return prisma.attendance.create({
    data: { userId, membershipId: membership.id, method, approvedByAdminId },
  });
}

export async function checkOut(userId: string) {
  const attendance = await prisma.attendance.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
  });
  if (!attendance) throw new AppError('No open check-in found', 404);

  const checkOutAt = new Date();
  const durationMinutes = Math.round((checkOutAt.getTime() - attendance.checkInAt.getTime()) / 60000);

  return prisma.attendance.update({ where: { id: attendance.id }, data: { checkOutAt, durationMinutes } });
}

export async function listMyAttendance(userId: string) {
  return prisma.attendance.findMany({ where: { userId }, orderBy: { checkInAt: 'desc' } });
}

export async function getCurrentStatus(userId: string) {
  const open = await prisma.attendance.findFirst({ where: { userId, checkOutAt: null } });
  return { checkedIn: Boolean(open), attendance: open };
}

// Front-desk fallback when QR scanning fails
export async function adminCheckIn(adminId: string, userId: string) {
  return checkIn(userId, AttendanceMethod.ADMIN_APPROVED, adminId);
}

export async function listAllAttendance(pagination: PaginationParams) {
  const [items, total] = await Promise.all([
    prisma.attendance.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { checkInAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.attendance.count(),
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
