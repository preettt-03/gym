import { prisma } from '@/lib/prisma';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / (24 * 60 * 60 * 1000));
}

async function awardStreakBadges(userId: string, currentStreak: number) {
  const eligibleBadges = await prisma.badge.findMany({ where: { streakThresholdDays: currentStreak } });
  await Promise.all(
    eligibleBadges.map((badge) =>
      prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        update: {},
        create: { userId, badgeId: badge.id },
      })
    )
  );
}

// Called whenever the user completes a streak-worthy action (currently: finishing a workout day)
export async function recordDailyActivity(userId: string) {
  const today = new Date();
  const streak = await prisma.userStreak.findUnique({ where: { userId } });

  if (!streak || !streak.lastActiveDate) {
    const updated = await prisma.userStreak.upsert({
      where: { userId },
      update: { currentStreak: 1, longestStreak: Math.max(1, streak?.longestStreak ?? 0), lastActiveDate: today },
      create: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today },
    });
    await awardStreakBadges(userId, updated.currentStreak);
    return updated;
  }

  const diff = daysBetween(streak.lastActiveDate, today);
  if (diff === 0) return streak; // already recorded today, no double-counting

  const newStreak = diff === 1 ? streak.currentStreak + 1 : 1;

  const updated = await prisma.userStreak.update({
    where: { userId },
    data: { currentStreak: newStreak, longestStreak: Math.max(newStreak, streak.longestStreak), lastActiveDate: today },
  });

  await awardStreakBadges(userId, updated.currentStreak);
  return updated;
}

export async function getMyStreak(userId: string) {
  const streak = await prisma.userStreak.findUnique({ where: { userId } });
  return streak ?? { userId, currentStreak: 0, longestStreak: 0, lastActiveDate: null };
}
