import crypto from 'crypto';
import { AccountStatus, ExperienceLevel, FitnessGoal, Gender, LeaderboardSettings, NotificationType, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/config/logger';
import { AppError } from '@/middlewares/errorHandler';
import { gymPeriodRange, type LeaderboardPeriod } from '@/lib/gym-time';
import { createNotification } from '@/features/notifications/notifications.service';

const SETTINGS_ID = 'default';
const DAY_MS = 24 * 60 * 60 * 1000;
// IST is UTC+5:30; per-day fraud checks bucket activity by the gym's calendar day.
const IST_INTERVAL = Prisma.sql`interval '330 minutes'`;
export const PUBLIC_BOARD_SIZE = 50;
const DISPLAY_BOARD_SIZE = 10;
const CACHE_TTL_SECONDS = 300;
const CACHE_VERSION_KEY = 'lb:version';

export type FraudFlag = 'TOO_MANY_WORKOUTS' | 'TOO_MANY_CALORIES' | 'LONG_VISIT';
export type CyclePeriod = Exclude<LeaderboardPeriod, 'all-time'>;
export const CYCLE_PERIODS: CyclePeriod[] = ['daily', 'weekly', 'monthly'];

// Fair-competition boards: rank only members who match.
export const SEGMENTS = ['all', 'women', 'men', 'beginner', 'intermediate', 'advanced', 'fat-loss', 'strength'] as const;
export type Segment = (typeof SEGMENTS)[number];

export interface RewardTier {
  enabled: boolean;
  coins: [number, number, number];
  xp: [number, number, number];
}
export type RewardsConfig = Record<CyclePeriod, RewardTier>;

const BADGES = [
  { name: 'Gold Champion', description: 'Finished #1 on a King’s Fitness leaderboard' },
  { name: 'Silver Medalist', description: 'Finished #2 on a King’s Fitness leaderboard' },
  { name: 'Bronze Medalist', description: 'Finished #3 on a King’s Fitness leaderboard' },
] as const;

export interface LeaderboardEntry {
  rank: number | null; // null when hidden or frozen
  userId: string;
  name: string;
  photoUrl: string | null;
  points: number;
  basePoints: number;
  adjustmentPoints: number;
  workouts: number;
  visits: number;
  caloriesBurned: number;
  gymMinutes: number;
  workoutMinutes: number;
  streakDays: number;
  flags: FraudFlag[];
  frozen: boolean;
  hidden: boolean;
  hiddenReason: string | null;
  gender: Gender | null;
  experienceLevel: ExperienceLevel | null;
  fitnessGoal: FitnessGoal | null;
  // Admin-only fields, stripped from the member view.
  email: string | null;
  phone: string | null;
}

interface Board {
  range: { start: Date; end: Date };
  entries: LeaderboardEntry[];
}

// --- Settings ---

export async function getSettings() {
  return prisma.leaderboardSettings.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID } });
}

export function rewardsOf(settings: LeaderboardSettings) {
  return settings.rewards as unknown as RewardsConfig;
}

export async function updateSettings(input: Partial<Omit<LeaderboardSettings, 'id' | 'updatedAt' | 'displayKey' | 'rewards'>> & { rewards?: RewardsConfig }) {
  const data = { ...input, rewards: input.rewards as unknown as Prisma.InputJsonValue | undefined };
  const settings = await prisma.leaderboardSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
  await invalidateCache();
  return settings;
}

/** Turns the reception TV link on with a fresh secret, or off. */
export async function setDisplayKey(enabled: boolean) {
  await getSettings();
  return prisma.leaderboardSettings.update({
    where: { id: SETTINGS_ID },
    data: { displayKey: enabled ? crypto.randomBytes(18).toString('base64url') : null },
  });
}

// --- Cache ---
// Boards are cached for a few minutes; any admin change bumps a version so the
// next read recomputes instead of waiting for the TTL.

export async function invalidateCache() {
  await redis.incr(CACHE_VERSION_KEY).catch((err) => logger.warn('Leaderboard cache bump failed', { err }));
}

async function cachedBoard(period: LeaderboardPeriod, offset: number): Promise<Board> {
  let key: string | null = null;
  try {
    const version = (await redis.get(CACHE_VERSION_KEY)) ?? '0';
    key = `lb:board:${version}:${period}:${offset}`;
    const hit = await redis.get(key);
    if (hit) {
      const parsed = JSON.parse(hit) as { range: { start: string; end: string }; entries: LeaderboardEntry[] };
      return { range: { start: new Date(parsed.range.start), end: new Date(parsed.range.end) }, entries: parsed.entries };
    }
  } catch (err) {
    logger.warn('Leaderboard cache read failed; computing live', { err });
  }
  const board = await computeBoard(period, offset);
  if (key) redis.set(key, JSON.stringify(board), 'EX', CACHE_TTL_SECONDS).catch(() => undefined);
  return board;
}

// --- Scoring ---

type Totals = Map<string, number>;

async function sumByUser(query: Prisma.Sql): Promise<Totals> {
  const rows = await prisma.$queryRaw<{ userId: string; value: bigint | number | null }[]>(query);
  return new Map(rows.map((r) => [r.userId, Number(r.value ?? 0)]));
}

/** Everything that feeds the score for one window, keyed by user id. */
async function collectActivity(start: Date, end: Date) {
  const [workouts, calories, workoutSeconds, visits, gymMinutes, adjustments] = await Promise.all([
    sumByUser(Prisma.sql`
      SELECT "userId", COUNT(*) AS value FROM workout_logs
      WHERE "completedAt" >= ${start} AND "completedAt" < ${end}
      GROUP BY "userId"`),
    sumByUser(Prisma.sql`
      SELECT w."userId", SUM(e."caloriesBurned") AS value
      FROM workout_exercise_logs e JOIN workout_logs w ON w.id = e."workoutLogId"
      WHERE e."completedAt" >= ${start} AND e."completedAt" < ${end}
      GROUP BY w."userId"`),
    sumByUser(Prisma.sql`
      SELECT w."userId", SUM(e."durationSeconds") AS value
      FROM workout_exercise_logs e JOIN workout_logs w ON w.id = e."workoutLogId"
      WHERE e."completedAt" >= ${start} AND e."completedAt" < ${end}
      GROUP BY w."userId"`),
    sumByUser(Prisma.sql`
      SELECT "userId", COUNT(*) AS value FROM attendances
      WHERE "checkInAt" >= ${start} AND "checkInAt" < ${end}
      GROUP BY "userId"`),
    sumByUser(Prisma.sql`
      SELECT "userId", SUM("durationMinutes") AS value FROM attendances
      WHERE "checkInAt" >= ${start} AND "checkInAt" < ${end}
      GROUP BY "userId"`),
    sumByUser(Prisma.sql`
      SELECT "userId", SUM(points) AS value FROM leaderboard_adjustments
      WHERE "effectiveAt" >= ${start} AND "effectiveAt" < ${end}
      GROUP BY "userId"`),
  ]);
  return { workouts, calories, workoutSeconds, visits, gymMinutes, adjustments };
}

/** Members whose logs in the window look implausible, with the rules they tripped. */
async function detectFraud(start: Date, end: Date, settings: LeaderboardSettings) {
  const [busyDays, burnDays, longVisits] = await Promise.all([
    sumByUser(Prisma.sql`
      SELECT "userId", MAX(n) AS value FROM (
        SELECT "userId", date_trunc('day', "completedAt" + ${IST_INTERVAL}) AS d, COUNT(*) AS n
        FROM workout_logs WHERE "completedAt" >= ${start} AND "completedAt" < ${end}
        GROUP BY 1, 2
      ) per_day GROUP BY "userId"`),
    sumByUser(Prisma.sql`
      SELECT "userId", MAX(n) AS value FROM (
        SELECT w."userId", date_trunc('day', e."completedAt" + ${IST_INTERVAL}) AS d, SUM(e."caloriesBurned") AS n
        FROM workout_exercise_logs e JOIN workout_logs w ON w.id = e."workoutLogId"
        WHERE e."completedAt" >= ${start} AND e."completedAt" < ${end}
        GROUP BY 1, 2
      ) per_day GROUP BY "userId"`),
    sumByUser(Prisma.sql`
      SELECT "userId", MAX("durationMinutes") AS value FROM attendances
      WHERE "checkInAt" >= ${start} AND "checkInAt" < ${end}
      GROUP BY "userId"`),
  ]);

  const flags = new Map<string, FraudFlag[]>();
  const add = (userId: string, flag: FraudFlag) => flags.set(userId, [...(flags.get(userId) ?? []), flag]);
  busyDays.forEach((n, id) => n > settings.maxWorkoutsPerDay && add(id, 'TOO_MANY_WORKOUTS'));
  burnDays.forEach((n, id) => n > settings.maxCaloriesPerDay && add(id, 'TOO_MANY_CALORIES'));
  longVisits.forEach((n, id) => n > settings.maxGymMinutesPerVisit && add(id, 'LONG_VISIT'));
  return flags;
}

/** Ranks visible entries 1..n in their current order; hidden/frozen/zero-point ones get none. */
function assignRanks<T extends { rank: number | null; hidden: boolean; frozen: boolean; points: number }>(entries: T[]) {
  let rank = 0;
  return entries.map((e) => ({ ...e, rank: !e.hidden && !e.frozen && e.points > 0 ? ++rank : null }));
}

/**
 * The full ranked board for a period, computed live. Hidden and frozen members
 * are listed (for admins) but don't take a rank, so public ranks have no gaps.
 */
export async function computeBoard(period: LeaderboardPeriod, offset = 0, now = new Date()): Promise<Board> {
  const settings = await getSettings();
  const { start, end } = gymPeriodRange(period, offset, now);
  const activity = await collectActivity(start, end);
  const flags = settings.fraudDetection ? await detectFraud(start, end, settings) : new Map<string, FraudFlag[]>();

  const userIds = new Set<string>();
  Object.values(activity).forEach((m) => m.forEach((_v, id) => userIds.add(id)));
  if (userIds.size === 0) return { range: { start, end }, entries: [] };

  const ids = [...userIds];
  const [users, streaks, exclusions, clearances] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids }, role: Role.USER, accountStatus: AccountStatus.ACTIVE },
      select: { id: true, name: true, email: true, phone: true, photoUrl: true, gender: true, experienceLevel: true, fitnessGoal: true },
    }),
    prisma.userStreak.findMany({ where: { userId: { in: ids } } }),
    prisma.leaderboardExclusion.findMany({ where: { userId: { in: ids } } }),
    prisma.leaderboardClearance.findMany({ where: { userId: { in: ids } } }),
  ]);
  const streakBy = new Map(streaks.map((s) => [s.userId, s]));
  const excludedBy = new Map(exclusions.map((e) => [e.userId, e]));
  const clearedAt = new Map(clearances.map((c) => [c.userId, c.clearedAt]));

  // A streak only counts if it's still alive at the window's start, and never for
  // more days than the window has — otherwise an old 60-day streak would swamp a daily board.
  const windowDays = period === 'all-time' ? Infinity : Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const streakFor = (userId: string) => {
    const s = streakBy.get(userId);
    if (!s?.lastActiveDate || s.lastActiveDate.getTime() < start.getTime() - DAY_MS) return 0;
    return Math.min(s.currentStreak, windowDays);
  };

  const entries: LeaderboardEntry[] = users.map((u) => {
    const workouts = activity.workouts.get(u.id) ?? 0;
    const visits = activity.visits.get(u.id) ?? 0;
    const caloriesBurned = activity.calories.get(u.id) ?? 0;
    const gymMinutes = activity.gymMinutes.get(u.id) ?? 0;
    const workoutMinutes = Math.round((activity.workoutSeconds.get(u.id) ?? 0) / 60);
    const streakDays = streakFor(u.id);
    const basePoints =
      workouts * settings.workoutPoints +
      visits * settings.visitPoints +
      Math.floor(caloriesBurned / Math.max(1, settings.caloriesPerPoint)) +
      gymMinutes * settings.gymMinutePoints +
      workoutMinutes * settings.workoutMinutePoints +
      streakDays * settings.streakPoints;
    const adjustmentPoints = activity.adjustments.get(u.id) ?? 0;
    const exclusion = excludedBy.get(u.id);
    const userFlags = flags.get(u.id) ?? [];
    // An approval covers every board that was already running when it was given.
    const approved = (clearedAt.get(u.id)?.getTime() ?? -Infinity) >= start.getTime();
    return {
      rank: null,
      userId: u.id,
      name: u.name ?? 'Member',
      photoUrl: u.photoUrl,
      points: Math.max(0, basePoints + adjustmentPoints),
      basePoints,
      adjustmentPoints,
      workouts,
      visits,
      caloriesBurned,
      gymMinutes,
      workoutMinutes,
      streakDays,
      flags: userFlags,
      frozen: settings.autoFreeze && userFlags.length > 0 && !approved,
      hidden: Boolean(exclusion),
      hiddenReason: exclusion?.reason ?? null,
      gender: u.gender,
      experienceLevel: u.experienceLevel,
      fitnessGoal: u.fitnessGoal,
      email: u.email,
      phone: u.phone,
    };
  });

  entries.sort((a, b) => b.points - a.points || b.workouts - a.workouts || a.name.localeCompare(b.name));
  return { range: { start, end }, entries: assignRanks(entries) };
}

/** Admin view: cached unless asked to recompute. */
export async function getAdminBoard(period: LeaderboardPeriod, offset: number) {
  const [settings, board] = await Promise.all([getSettings(), cachedBoard(period, offset)]);
  return { settings, ...board };
}

const SEGMENT_MATCH: Record<Segment, (e: LeaderboardEntry) => boolean> = {
  all: () => true,
  women: (e) => e.gender === Gender.FEMALE,
  men: (e) => e.gender === Gender.MALE,
  beginner: (e) => e.experienceLevel === ExperienceLevel.BEGINNER,
  intermediate: (e) => e.experienceLevel === ExperienceLevel.INTERMEDIATE,
  advanced: (e) => e.experienceLevel === ExperienceLevel.ADVANCED,
  'fat-loss': (e) => e.fitnessGoal === FitnessGoal.WEIGHT_LOSS,
  strength: (e) => e.fitnessGoal === FitnessGoal.MUSCLE_GAIN,
};

function publicEntry(e: LeaderboardEntry) {
  return {
    rank: e.rank!,
    userId: e.userId,
    name: e.name,
    photoUrl: e.photoUrl,
    points: e.points,
    workouts: e.workouts,
    visits: e.visits,
    caloriesBurned: e.caloriesBurned,
    gymMinutes: e.gymMinutes,
    workoutMinutes: e.workoutMinutes,
    streakDays: e.streakDays,
  };
}

/** What members see: visible entries only, no contact details, plus where they stand. */
export async function getPublicBoard(period: LeaderboardPeriod, viewerId: string, segment: Segment = 'all') {
  const [settings, board] = await Promise.all([getSettings(), cachedBoard(period, 0)]);
  if (!settings.isEnabled) return { enabled: false as const, period, segment, range: board.range, entries: [], me: null };

  const ranked = assignRanks(board.entries.filter(SEGMENT_MATCH[segment]))
    .filter((e) => e.rank !== null)
    .map(publicEntry);

  const mine = ranked.find((e) => e.userId === viewerId);
  const above = mine && mine.rank > 1 ? ranked[mine.rank - 2] : null;
  const me = mine
    ? { rank: mine.rank, points: mine.points, pointsBehindNext: above ? above.points - mine.points : 0 }
    : { rank: null, points: 0, pointsBehindNext: ranked.length ? ranked[ranked.length - 1].points : 0 };

  const shown = ranked.slice(0, PUBLIC_BOARD_SIZE);
  const fives = await highFiveCounts(period, board.range.start, shown.map((e) => e.userId), viewerId);

  return {
    enabled: true as const,
    period,
    segment,
    range: board.range,
    entries: shown.map((e) => ({ ...e, highFives: fives.counts.get(e.userId) ?? 0, highFivedByMe: fives.mine.has(e.userId) })),
    totalRanked: ranked.length,
    me,
    weights: {
      workoutPoints: settings.workoutPoints,
      visitPoints: settings.visitPoints,
      caloriesPerPoint: settings.caloriesPerPoint,
      gymMinutePoints: settings.gymMinutePoints,
      workoutMinutePoints: settings.workoutMinutePoints,
      streakPoints: settings.streakPoints,
    },
    rewards: rewardsOf(settings),
  };
}

// --- High-fives ---

async function highFiveCounts(period: LeaderboardPeriod, periodStart: Date, userIds: string[], viewerId: string) {
  if (!userIds.length) return { counts: new Map<string, number>(), mine: new Set<string>() };
  const [grouped, mine] = await Promise.all([
    prisma.leaderboardHighFive.groupBy({ by: ['toUserId'], where: { period, periodStart, toUserId: { in: userIds } }, _count: true }),
    prisma.leaderboardHighFive.findMany({ where: { period, periodStart, fromUserId: viewerId, toUserId: { in: userIds } }, select: { toUserId: true } }),
  ]);
  return { counts: new Map(grouped.map((g) => [g.toUserId, g._count])), mine: new Set(mine.map((m) => m.toUserId)) };
}

/** One high-five per member per board; repeats are a no-op. */
export async function giveHighFive(fromUserId: string, toUserId: string, period: LeaderboardPeriod) {
  if (fromUserId === toUserId) throw new AppError('You can’t high-five yourself', 422);
  const [to, from] = await Promise.all([
    prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: fromUserId }, select: { name: true } }),
  ]);
  if (!to) throw new AppError('Member not found', 404);

  const { start } = gymPeriodRange(period, 0);
  const created = await prisma.leaderboardHighFive
    .create({ data: { fromUserId, toUserId, period, periodStart: start } })
    .then(() => true)
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
      throw err;
    });

  if (created) {
    await createNotification(toUserId, NotificationType.LEADERBOARD, `${from?.name ?? 'A member'} high-fived you 👏`, 'Keep crushing it on the leaderboard!', {
      kind: 'high-five',
      period,
    }).catch((err) => logger.error('High-five notification failed', { err }));
  }
  const count = await prisma.leaderboardHighFive.count({ where: { toUserId, period, periodStart: start } });
  return { count, highFivedByMe: true };
}

// --- Celebrations (winner pop-up) ---

const CELEBRATE_WITHIN_MS = 7 * DAY_MS;

export async function listCelebrations(userId: string) {
  const awards = await prisma.leaderboardAward.findMany({
    where: { userId, celebratedAt: null, createdAt: { gte: new Date(Date.now() - CELEBRATE_WITHIN_MS) } },
    orderBy: { createdAt: 'desc' },
    include: { snapshot: { select: { period: true, periodStart: true, periodEnd: true } } },
  });
  return awards.map((a) => ({
    id: a.id,
    rank: a.rank,
    points: a.points,
    coins: a.coins,
    xp: a.xp,
    badgeName: a.badgeName,
    period: a.snapshot.period as CyclePeriod,
    periodStart: a.snapshot.periodStart,
    periodEnd: a.snapshot.periodEnd,
  }));
}

export async function markCelebrated(userId: string, awardId: string) {
  const { count } = await prisma.leaderboardAward.updateMany({ where: { id: awardId, userId }, data: { celebratedAt: new Date() } });
  if (!count) throw new AppError('Award not found', 404);
}

// --- Cycle end: snapshot, rewards, notifications ---

const CYCLE_PHRASE: Record<CyclePeriod, string> = { daily: 'yesterday', weekly: 'last week', monthly: 'last month' };

/**
 * Freezes the top of every period that has just ended and pays out its winners.
 * Safe to call repeatedly: a period is only ever snapshotted once.
 */
export async function closeFinishedCycles(now = new Date()) {
  const settings = await getSettings();
  const rewards = rewardsOf(settings);
  const results: { period: CyclePeriod; winners: number }[] = [];

  for (const period of CYCLE_PERIODS) {
    const { start, end } = gymPeriodRange(period, 1, now);
    const exists = await prisma.leaderboardSnapshot.findUnique({ where: { period_periodStart: { period, periodStart: start } } });
    if (exists) continue;

    // Always recompute (never the cache): the snapshot is the record of who won.
    const board = await computeBoard(period, 1, now);
    const top = board.entries.filter((e) => e.rank !== null).slice(0, 10);
    const tier = rewards[period];
    const winners = tier?.enabled ? top.slice(0, 3) : [];

    try {
      await prisma.$transaction(async (tx) => {
        const snapshot = await tx.leaderboardSnapshot.create({
          data: {
            period,
            periodStart: start,
            periodEnd: end,
            entries: top.map(publicEntry) as unknown as Prisma.InputJsonValue,
          },
        });
        for (const [i, w] of winners.entries()) {
          const badge = BADGES[i];
          const coins = tier.coins[i] ?? 0;
          const xp = tier.xp[i] ?? 0;
          await tx.leaderboardAward.create({
            data: { snapshotId: snapshot.id, userId: w.userId, rank: i + 1, points: w.points, coins, xp, badgeName: badge.name },
          });
          await tx.user.update({ where: { id: w.userId }, data: { coins: { increment: coins }, xp: { increment: xp } } });
          const b = await tx.badge.upsert({ where: { name: badge.name }, update: {}, create: { name: badge.name, description: badge.description } });
          await tx.userBadge.createMany({ data: [{ userId: w.userId, badgeId: b.id }], skipDuplicates: true });
        }
      });
    } catch (err) {
      // Another instance got there first.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
      throw err;
    }

    for (const [i, w] of winners.entries()) {
      const coins = tier.coins[i] ?? 0;
      const xp = tier.xp[i] ?? 0;
      const prize = [coins && `+${coins} coins`, xp && `+${xp} XP`, BADGES[i].name].filter(Boolean).join(' · ');
      await createNotification(w.userId, NotificationType.LEADERBOARD, `🏆 You finished #${i + 1} ${CYCLE_PHRASE[period]}!`, prize, {
        kind: 'award',
        period,
        rank: i + 1,
      }).catch((err) => logger.error('Award notification failed', { err }));
    }
    results.push({ period, winners: winners.length });
    logger.info(`Leaderboard ${period} cycle closed`, { start, winners: winners.length });
  }
  await invalidateCache();
  return results;
}

export async function listSnapshots(period?: CyclePeriod, limit = 12) {
  return prisma.leaderboardSnapshot.findMany({
    where: period ? { period } : undefined,
    orderBy: { periodStart: 'desc' },
    take: limit,
    include: { awards: { orderBy: { rank: 'asc' }, include: { user: { select: { id: true, name: true, photoUrl: true } } } } },
  });
}

// --- Overtake alerts ---

const OVERTAKE_WATCH_TOP = 20;

/**
 * Compares this week's ranks with the last check and tells members who just got
 * passed. At most one alert per member per day so it nudges rather than nags.
 */
export async function sendOvertakeAlerts(now = new Date()) {
  const settings = await getSettings();
  if (!settings.isEnabled || !settings.overtakeAlerts) return { sent: 0 };

  const board = await computeBoard('weekly', 0, now);
  const key = `lb:ranks:weekly:${board.range.start.toISOString()}`;
  const previous = await redis.hgetall(key);
  const current = board.entries.filter((e) => e.rank !== null);
  if (current.length) {
    await redis.hset(key, Object.fromEntries(current.map((e) => [e.userId, String(e.rank)])));
    await redis.expire(key, 8 * 24 * 60 * 60);
  }
  if (!Object.keys(previous).length) return { sent: 0 };

  const byRank = new Map(current.map((e) => [e.rank!, e]));
  const rankOf = new Map(current.map((e) => [e.userId, e.rank!]));
  const today = now.toISOString().slice(0, 10);
  let sent = 0;

  for (const [userId, prevRankRaw] of Object.entries(previous)) {
    const prevRank = Number(prevRankRaw);
    const nowRank = rankOf.get(userId);
    if (prevRank > OVERTAKE_WATCH_TOP || nowRank === undefined || nowRank <= prevRank) continue;
    const taker = byRank.get(prevRank);
    // Only when someone actually climbed past them (not e.g. a re-rank after a hide).
    if (!taker || taker.userId === userId || Number(previous[taker.userId] ?? Infinity) <= prevRank) continue;

    const fresh = await redis.set(`lb:overtake:${userId}:${today}`, '1', 'EX', DAY_MS / 1000, 'NX');
    if (!fresh) continue;
    await createNotification(
      userId,
      NotificationType.LEADERBOARD,
      `${taker.name} just took #${prevRank} from you!`,
      `You're #${nowRank} this week. Hit the gym to take it back 💪`,
      { kind: 'overtaken', period: 'weekly', rank: nowRank }
    ).catch((err) => logger.error('Overtake notification failed', { err }));
    sent++;
  }
  return { sent };
}

// --- Monday wrap-up ---

export async function sendWeeklyWrapUp(sendMail: (to: string, subject: string, html: string) => Promise<void>, now = new Date()) {
  const settings = await getSettings();
  if (!settings.isEnabled || !settings.weeklyWrapUp) return { sent: 0 };

  const board = await computeBoard('weekly', 1, now);
  const fresh = await redis.set(`lb:wrapup:${board.range.start.toISOString()}`, '1', 'EX', 14 * DAY_MS / 1000, 'NX');
  if (!fresh) return { sent: 0 };

  const ranked = board.entries.filter((e) => e.rank !== null);
  const top3 = ranked.slice(0, 3).map((e) => `#${e.rank} ${e.name} (${e.points.toLocaleString('en-IN')} pts)`);
  let sent = 0;
  for (const e of ranked) {
    const title = `Last week you ranked #${e.rank} with ${e.points.toLocaleString('en-IN')} pts`;
    const body = `Top 3: ${top3.join(', ')}. A new week has started — go get it!`;
    await createNotification(e.userId, NotificationType.LEADERBOARD, title, body, { kind: 'wrap-up', period: 'weekly', rank: e.rank }).catch((err) =>
      logger.error('Wrap-up notification failed', { err })
    );
    if (e.email) {
      const list = top3.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
      await sendMail(
        e.email,
        `King's Fitness weekly wrap-up: you were #${e.rank}`,
        `<p>Hi ${escapeHtml(e.name)},</p><p>${escapeHtml(title)} at King's Fitness.</p><p>Top 3 last week:</p><ol>${list}</ol><p>A new week has started — see you at the gym!</p>`
      ).catch((err) => logger.error('Wrap-up email failed', { err, userId: e.userId }));
    }
    sent++;
  }
  logger.info('Leaderboard weekly wrap-up sent', { sent, at: now.toISOString() });
  return { sent };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// --- Reception TV display ---

function keysMatch(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// "Preet Patel" -> "Preet P." — enough for the gym floor, not a full name on a public screen.
function displayName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

export async function getDisplayBoards(key: string) {
  const settings = await getSettings();
  if (!settings.displayKey || !keysMatch(settings.displayKey, key)) throw new AppError('Display link is invalid or switched off', 404);
  if (!settings.isEnabled) return { enabled: false as const, boards: [] };

  const periods: CyclePeriod[] = ['daily', 'weekly'];
  const boards = await Promise.all(
    periods.map(async (period) => {
      const board = await cachedBoard(period, 0);
      return {
        period,
        range: board.range,
        entries: board.entries
          .filter((e) => e.rank !== null)
          .slice(0, DISPLAY_BOARD_SIZE)
          .map((e) => ({ rank: e.rank!, name: displayName(e.name), photoUrl: e.photoUrl, points: e.points, workouts: e.workouts, caloriesBurned: e.caloriesBurned, gymMinutes: e.gymMinutes })),
      };
    })
  );
  return { enabled: true as const, boards };
}

// --- Admin corrections ---

async function assertMember(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError('Member not found', 404);
}

export async function addAdjustment(adminId: string, userId: string, points: number, reason: string) {
  await assertMember(userId);
  const adjustment = await prisma.leaderboardAdjustment.create({ data: { userId, points, reason, createdById: adminId } });
  await invalidateCache();
  return adjustment;
}

export async function listAdjustments(userId: string) {
  return prisma.leaderboardAdjustment.findMany({
    where: { userId },
    orderBy: { effectiveAt: 'desc' },
    take: 50,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function deleteAdjustment(id: string) {
  const found = await prisma.leaderboardAdjustment.findUnique({ where: { id } });
  if (!found) throw new AppError('Adjustment not found', 404);
  await prisma.leaderboardAdjustment.delete({ where: { id } });
  await invalidateCache();
}

export async function setVisibility(adminId: string, userId: string, hidden: boolean, reason?: string) {
  await assertMember(userId);
  if (hidden) {
    await prisma.leaderboardExclusion.upsert({
      where: { userId },
      update: { reason: reason ?? null, createdById: adminId },
      create: { userId, reason: reason ?? null, createdById: adminId },
    });
  } else {
    await prisma.leaderboardExclusion.deleteMany({ where: { userId } });
  }
  await invalidateCache();
}

/** Admin reviewed a frozen member and found the logs genuine. */
export async function approveMember(adminId: string, userId: string) {
  await assertMember(userId);
  await prisma.leaderboardClearance.upsert({
    where: { userId },
    update: { clearedAt: new Date(), clearedById: adminId },
    create: { userId, clearedById: adminId },
  });
  await invalidateCache();
}

// --- Hall of Fame ---

/** Finished cycles, newest first, with their podium (public fields only). */
export async function getHallOfFame(period: CyclePeriod, limit = 12) {
  const snapshots = await prisma.leaderboardSnapshot.findMany({
    where: { period },
    orderBy: { periodStart: 'desc' },
    take: limit,
  });
  return snapshots
    .map((s) => ({
      id: s.id,
      period: s.period as CyclePeriod,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      podium: (s.entries as unknown as ReturnType<typeof publicEntry>[]).slice(0, 3),
    }))
    .filter((s) => s.podium.length > 0);
}
