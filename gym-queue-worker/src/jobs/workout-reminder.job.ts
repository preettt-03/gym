import { NotificationType, PlanSource } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendReminder } from '@/lib/notify';
import { logger } from '@/config/logger';

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function runWorkoutReminderJob() {
  const today = startOfDay();

  const [assignedUsers, ownedPlans] = await Promise.all([
    prisma.workoutPlanAssignment.findMany({
      where: { isActive: true, plan: { deletedAt: null } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.workoutPlan.findMany({
      where: { source: PlanSource.USER, deletedAt: null, ownerId: { not: null } },
      select: { ownerId: true },
      distinct: ['ownerId'],
    }),
  ]);

  const candidateIds = new Set<string>([
    ...assignedUsers.map((a) => a.userId),
    ...ownedPlans.map((o) => o.ownerId).filter((id): id is string => Boolean(id)),
  ]);

  let sent = 0;
  for (const userId of candidateIds) {
    const completedToday = await prisma.workoutLog.findFirst({
      where: { userId, completedAt: { gte: today } },
    });
    if (completedToday) continue;

    const alreadyRemindedToday = await prisma.notification.findFirst({
      where: { userId, type: NotificationType.WORKOUT_REMINDER, createdAt: { gte: today } },
    });
    if (alreadyRemindedToday) continue;

    await sendReminder(
      userId,
      NotificationType.WORKOUT_REMINDER,
      "Don't break your streak!",
      "You haven't logged a workout today — jump in when you're ready."
    );
    sent++;
  }

  logger.info(`Workout reminder job complete: ${sent} reminders sent`);
  return { sent };
}
