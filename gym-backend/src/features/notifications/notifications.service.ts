import { NotificationType, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { PaginationParams } from '@/lib/pagination';
import { emitToUser } from '@/lib/socket';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  data?: Prisma.InputJsonValue
) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data },
  });

  emitToUser(userId, 'notification:new', notification);
  return notification;
}

export async function listMyNotifications(userId: string, pagination: PaginationParams, unreadOnly?: boolean) {
  const where: Prisma.NotificationWhereInput = { userId };
  if (unreadOnly) where.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    items,
    unreadCount,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

export async function markNotificationRead(userId: string, id: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new AppError('Notification not found', 404);

  await prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export async function broadcastAnnouncement(title: string, body: string | undefined, userIds?: string[]) {
  const targets = userIds?.length
    ? await prisma.user.findMany({ where: { id: { in: userIds }, deletedAt: null }, select: { id: true } })
    : await prisma.user.findMany({ where: { role: Role.USER, deletedAt: null }, select: { id: true } });

  await prisma.notification.createMany({
    data: targets.map((t) => ({
      userId: t.id,
      type: NotificationType.ADMIN_ANNOUNCEMENT,
      title,
      body,
    })),
  });

  targets.forEach((t) => emitToUser(t.id, 'notification:new', { type: NotificationType.ADMIN_ANNOUNCEMENT, title, body }));

  return { notified: targets.length };
}
