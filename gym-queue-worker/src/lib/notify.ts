import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NOTIFICATION_CHANNEL, publisher } from '@/lib/redis';
import { logger } from '@/config/logger';

export async function sendReminder(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  data?: Prisma.InputJsonValue
) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data },
  });

  try {
    await publisher.publish(NOTIFICATION_CHANNEL, JSON.stringify({ userId, notification }));
  } catch (err) {
    // Notification is already persisted; realtime push is best-effort.
    logger.warn('Failed to publish realtime notification event', { err });
  }

  return notification;
}
