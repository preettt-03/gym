import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { redis } from '@/lib/redis';
import { sendMail } from '@/lib/mailer';
import { gymDateKey } from '@/lib/gym-time';
import * as service from '@/features/leaderboard/leaderboard.service';

const TICK_MS = 5 * 60 * 1000;
const FIRST_TICK_MS = 30 * 1000;
const LOCK_KEY = 'lb:tick-lock';
const WRAP_UP_HOUR_IST = 9;

// IST weekday (Mon = 1) and hour for `now`.
function istClock(now: Date) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return { weekday: ist.getUTCDay(), hour: ist.getUTCHours() };
}

/** One pass of the leaderboard's background work. Every step is idempotent. */
export async function runLeaderboardTick(now = new Date()) {
  // Several backend instances may run this; only one does the work per tick.
  const locked = await redis.set(LOCK_KEY, gymDateKey(now), 'PX', TICK_MS - 10_000, 'NX');
  if (!locked) return;
  try {
    await service.closeFinishedCycles(now);
    const { weekday, hour } = istClock(now);
    if (weekday === 1 && hour >= WRAP_UP_HOUR_IST) await service.sendWeeklyWrapUp(sendMail, now);
    await service.sendOvertakeAlerts(now);
  } catch (err) {
    logger.error('Leaderboard background tick failed', { err });
  }
}

export function startLeaderboardScheduler() {
  if (env.NODE_ENV === 'test') return () => undefined;
  const first = setTimeout(() => void runLeaderboardTick(), FIRST_TICK_MS);
  const every = setInterval(() => void runLeaderboardTick(), TICK_MS);
  first.unref();
  every.unref();
  logger.info('Leaderboard scheduler started');
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
