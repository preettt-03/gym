import { MembershipStatus, NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendReminder } from '@/lib/notify';
import { logger } from '@/config/logger';

const EXPIRY_WINDOW_DAYS = 3;

export async function runMembershipExpiryJob() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const expiringMemberships = await prisma.membership.findMany({
    where: { status: MembershipStatus.ACTIVE, endDate: { gte: now, lte: windowEnd } },
    include: { plan: { select: { name: true } } },
  });

  let sent = 0;
  for (const membership of expiringMemberships) {
    const alreadyReminded = await prisma.notification.findFirst({
      where: { userId: membership.userId, type: NotificationType.MEMBERSHIP_EXPIRY, createdAt: { gte: oneDayAgo } },
    });
    if (alreadyReminded) continue;

    const daysLeft = Math.ceil((membership.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    await sendReminder(
      membership.userId,
      NotificationType.MEMBERSHIP_EXPIRY,
      'Your membership is expiring soon',
      `Your ${membership.plan.name} plan expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep your access.`,
      { membershipId: membership.id }
    );
    sent++;
  }

  logger.info(`Membership expiry job complete: ${sent} reminders sent`);
  return { sent };
}
