import { NotificationType, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendReminder } from '@/lib/notify';
import { logger } from '@/config/logger';

const REMINDER_WINDOW_HOURS = 24;

export async function runMissionReminderJob() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const endingSoonMissions = await prisma.mission.findMany({
    where: { isActive: true, deletedAt: null, startDate: { lte: now }, endDate: { gte: now, lte: windowEnd } },
  });

  if (endingSoonMissions.length === 0) {
    logger.info('Mission reminder job complete: no missions ending soon');
    return { sent: 0 };
  }

  const users = await prisma.user.findMany({ where: { role: Role.USER, deletedAt: null }, select: { id: true } });

  let sent = 0;
  for (const mission of endingSoonMissions) {
    const completedProgress = await prisma.userMissionProgress.findMany({
      where: { missionId: mission.id, isCompleted: true },
      select: { userId: true },
    });
    const completedUserIds = new Set(completedProgress.map((p) => p.userId));

    for (const user of users) {
      if (completedUserIds.has(user.id)) continue;

      const alreadyReminded = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: NotificationType.MISSION_REMINDER,
          createdAt: { gte: oneDayAgo },
          data: { path: ['missionId'], equals: mission.id },
        },
      });
      if (alreadyReminded) continue;

      await sendReminder(
        user.id,
        NotificationType.MISSION_REMINDER,
        `Mission ending soon: ${mission.title}`,
        'Complete it before it closes to claim your reward.',
        { missionId: mission.id }
      );
      sent++;
    }
  }

  logger.info(`Mission reminder job complete: ${sent} reminders sent`);
  return { sent };
}
