import { NotificationType, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendReminder } from '@/lib/notify';
import { logger } from '@/config/logger';

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function runDietReminderJob() {
  const today = startOfDay();

  const users = await prisma.user.findMany({ where: { role: Role.USER, deletedAt: null }, select: { id: true } });

  let sent = 0;
  for (const user of users) {
    const loggedToday = await prisma.nutritionLog.findFirst({
      where: { userId: user.id, loggedAt: { gte: today } },
    });
    if (loggedToday) continue;

    const alreadyReminded = await prisma.notification.findFirst({
      where: { userId: user.id, type: NotificationType.DIET_REMINDER, createdAt: { gte: today } },
    });
    if (alreadyReminded) continue;

    await sendReminder(
      user.id,
      NotificationType.DIET_REMINDER,
      "Log today's meals",
      'Keep your nutrition tracking up to date to hit your goals.'
    );
    sent++;
  }

  logger.info(`Diet reminder job complete: ${sent} reminders sent`);
  return { sent };
}
