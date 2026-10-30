import { MembershipStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// The gym runs on Indian time, so "a day" in every trend is an IST calendar day.
const TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_WINDOW_DAYS = 7;

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export interface DailyPoint {
  date: string; // YYYY-MM-DD in IST
  value: number;
}

// UTC instant of IST midnight `daysAgo` days before today (IST).
function istMidnight(daysAgo: number, now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const midnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - daysAgo * DAY_MS;
  return new Date(midnightIst - IST_OFFSET_MS);
}

function istDateKey(instant: Date) {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Every IST day in [from, from + days), zero-filled so charts have no gaps.
function fillDays(from: Date, days: number, rows: { day: string; total: number }[]): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.total)]));
  return Array.from({ length: days }, (_, i) => {
    const date = istDateKey(new Date(from.getTime() + i * DAY_MS));
    return { date, value: byDay.get(date) ?? 0 };
  });
}

// Raw SQL keeps the bucketing in Postgres; identifiers are fixed, values are bound.
function dailyBuckets(sql: Prisma.Sql) {
  return prisma.$queryRaw<{ day: string; total: number }[]>(sql);
}

function sum(points: DailyPoint[]) {
  return points.reduce((acc, p) => acc + p.value, 0);
}

export async function getDashboardAnalytics(days: AnalyticsRange) {
  const now = new Date();
  const from = istMidnight(days - 1, now);
  const previousFrom = istMidnight(2 * days - 1, now);
  const expiringBy = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * DAY_MS);

  const [
    revenueRows,
    signupRows,
    attendanceRows,
    previousRevenue,
    previousSignups,
    previousAttendance,
    activeCount,
    expiringCount,
    expiredCount,
    cancelledCount,
    activeByPlan,
    plans,
    paymentStatusCounts,
    expiringSoon,
    recentPayments,
  ] = await Promise.all([
    dailyBuckets(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM-DD') AS day,
             SUM(amount)::float AS total
      FROM payments
      WHERE status = 'COMPLETED' AND "createdAt" >= ${from}
      GROUP BY day`),
    dailyBuckets(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS total
      FROM users
      WHERE role = 'USER' AND "deletedAt" IS NULL AND "createdAt" >= ${from}
      GROUP BY day`),
    dailyBuckets(Prisma.sql`
      SELECT to_char(("checkInAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS total
      FROM attendances
      WHERE "checkInAt" >= ${from}
      GROUP BY day`),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.COMPLETED, createdAt: { gte: previousFrom, lt: from } },
      _sum: { amount: true },
    }),
    prisma.user.count({
      where: { role: Role.USER, deletedAt: null, createdAt: { gte: previousFrom, lt: from } },
    }),
    prisma.attendance.count({ where: { checkInAt: { gte: previousFrom, lt: from } } }),
    prisma.membership.count({ where: { status: MembershipStatus.ACTIVE, endDate: { gt: expiringBy } } }),
    prisma.membership.count({ where: { status: MembershipStatus.ACTIVE, endDate: { gte: now, lte: expiringBy } } }),
    // Rows still marked ACTIVE but past their end date count as expired too.
    prisma.membership.count({
      where: {
        OR: [{ status: MembershipStatus.EXPIRED }, { status: MembershipStatus.ACTIVE, endDate: { lt: now } }],
      },
    }),
    prisma.membership.count({ where: { status: MembershipStatus.CANCELLED } }),
    prisma.membership.groupBy({
      by: ['planId'],
      where: { status: MembershipStatus.ACTIVE, endDate: { gte: now } },
      _count: { _all: true },
    }),
    prisma.membershipPlan.findMany({ select: { id: true, name: true } }),
    prisma.payment.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from } },
      _count: { _all: true },
    }),
    prisma.membership.findMany({
      where: { status: MembershipStatus.ACTIVE, endDate: { gte: now, lte: expiringBy } },
      orderBy: { endDate: 'asc' },
      take: 6,
      select: {
        id: true,
        endDate: true,
        plan: { select: { name: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    }),
    prisma.payment.findMany({
      where: { status: PaymentStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        amount: true,
        currency: true,
        createdAt: true,
        plan: { select: { name: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    }),
  ]);

  const revenue = fillDays(from, days, revenueRows);
  const signups = fillDays(from, days, signupRows);
  const attendance = fillDays(from, days, attendanceRows);
  const planNames = new Map(plans.map((p) => [p.id, p.name]));

  return {
    range: { days, from: istDateKey(from), to: istDateKey(now), timeZone: TIME_ZONE },
    totals: {
      revenue: { current: sum(revenue), previous: previousRevenue._sum.amount ?? 0 },
      signups: { current: sum(signups), previous: previousSignups },
      attendance: { current: sum(attendance), previous: previousAttendance },
    },
    trends: { revenue, signups, attendance },
    membershipStatus: {
      active: activeCount,
      expiringSoon: expiringCount,
      expired: expiredCount,
      cancelled: cancelledCount,
      expiringWindowDays: EXPIRING_WINDOW_DAYS,
    },
    activeByPlan: activeByPlan
      .map((row) => ({ planId: row.planId, name: planNames.get(row.planId) ?? 'Unknown plan', count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    paymentStatus: Object.fromEntries(
      Object.values(PaymentStatus).map((s) => [s, paymentStatusCounts.find((r) => r.status === s)?._count._all ?? 0])
    ) as Record<PaymentStatus, number>,
    expiringSoon,
    recentPayments,
  };
}
