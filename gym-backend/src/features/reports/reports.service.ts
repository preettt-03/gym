import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface DateRange {
  from?: Date;
  to?: Date;
}

interface ReportData {
  title: string;
  headers: string[];
  rows: (string | number | null)[][];
}

function dateWhere(field: string, range: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  return { gte: range.from, lte: range.to };
}

export async function getRevenueReport(range: DateRange): Promise<ReportData> {
  const payments = await prisma.payment.findMany({
    where: { createdAt: dateWhere('createdAt', range) },
    include: { user: { select: { email: true } }, plan: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    title: 'Revenue Report',
    headers: ['Date', 'User', 'Plan', 'Amount', 'Currency', 'Gateway', 'Status', 'Invoice #'],
    rows: payments.map((p) => [
      p.createdAt.toISOString(),
      p.user.email,
      p.plan.name,
      p.amount,
      p.currency,
      p.gateway,
      p.status,
      p.invoiceNumber ?? '',
    ]),
  };
}

export async function getAttendanceReport(range: DateRange): Promise<ReportData> {
  const items = await prisma.attendance.findMany({
    where: { checkInAt: dateWhere('checkInAt', range) },
    include: { user: { select: { email: true } } },
    orderBy: { checkInAt: 'desc' },
  });

  return {
    title: 'Attendance Report',
    headers: ['User', 'Check-in', 'Check-out', 'Duration (min)', 'Method'],
    rows: items.map((a) => [
      a.user.email,
      a.checkInAt.toISOString(),
      a.checkOutAt?.toISOString() ?? '',
      a.durationMinutes ?? '',
      a.method,
    ]),
  };
}

export async function getMembershipReport(): Promise<ReportData> {
  const memberships = await prisma.membership.findMany({
    include: { user: { select: { email: true } }, plan: { select: { name: true } } },
    orderBy: { endDate: 'desc' },
  });

  return {
    title: 'Membership Report',
    headers: ['User', 'Plan', 'Status', 'Start Date', 'End Date'],
    rows: memberships.map((m) => [
      m.user.email,
      m.plan.name,
      m.status,
      m.startDate.toISOString(),
      m.endDate.toISOString(),
    ]),
  };
}

export async function getUserReport(range: DateRange): Promise<ReportData> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, createdAt: dateWhere('createdAt', range) },
    orderBy: { createdAt: 'desc' },
  });

  return {
    title: 'User Report',
    headers: ['Email', 'Name', 'Role', 'Account Status', 'Email Verified', 'Joined'],
    rows: users.map((u) => [
      u.email,
      u.name ?? '',
      u.role,
      u.accountStatus,
      u.isEmailVerified ? 'Yes' : 'No',
      u.createdAt.toISOString(),
    ]),
  };
}

export async function getWorkoutReport(range: DateRange): Promise<ReportData> {
  const logs = await prisma.workoutLog.findMany({
    where: { date: dateWhere('date', range) },
    include: {
      user: { select: { email: true } },
      plan: { select: { title: true } },
      day: { select: { title: true, dayNumber: true } },
      exerciseLogs: { select: { id: true } },
    },
    orderBy: { date: 'desc' },
  });

  return {
    title: 'Workout Completion Report',
    headers: ['User', 'Plan', 'Day', 'Date', 'Completed At', 'Sets Logged'],
    rows: logs.map((l) => [
      l.user.email,
      l.plan?.title ?? '',
      l.day?.title ?? (l.day ? `Day ${l.day.dayNumber}` : ''),
      l.date.toISOString(),
      l.completedAt?.toISOString() ?? '',
      l.exerciseLogs.length,
    ]),
  };
}

export async function getDietReport(): Promise<ReportData> {
  const plans = await prisma.dietPlan.findMany({
    where: { deletedAt: null },
    include: {
      assignments: { include: { user: { select: { email: true } } } },
      owner: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows: (string | number | null)[][] = [];
  for (const plan of plans) {
    if (plan.source === 'USER' && plan.owner) {
      rows.push([plan.title, plan.source, plan.owner.email, plan.estimatedCalories ?? '']);
    }
    for (const assignment of plan.assignments) {
      if (assignment.isActive) {
        rows.push([plan.title, plan.source, assignment.user.email, plan.estimatedCalories ?? '']);
      }
    }
  }

  return {
    title: 'Diet Plan Report',
    headers: ['Plan', 'Source', 'User', 'Estimated Calories'],
    rows,
  };
}

export type ReportType = 'revenue' | 'attendance' | 'membership' | 'users' | 'workout' | 'diet';

export async function getReport(type: ReportType, range: DateRange): Promise<ReportData> {
  switch (type) {
    case 'revenue':
      return getRevenueReport(range);
    case 'attendance':
      return getAttendanceReport(range);
    case 'membership':
      return getMembershipReport();
    case 'users':
      return getUserReport(range);
    case 'workout':
      return getWorkoutReport(range);
    case 'diet':
      return getDietReport();
  }
}
