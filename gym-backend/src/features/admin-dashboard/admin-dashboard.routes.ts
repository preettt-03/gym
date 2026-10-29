import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { requireAuth, requireRole } from '@/middlewares/auth';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import {
  ANALYTICS_RANGES,
  AnalyticsRange,
  getDashboardAnalytics,
} from '@/features/admin-dashboard/admin-dashboard.service';

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAuth, requireRole(Role.ADMIN));

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

adminDashboardRouter.get(
  '/',
  asyncHandler(async (_req, res: Response) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = startOfDay();

    const [
      totalUsers,
      newUsersLast7Days,
      totalExercises,
      totalWorkoutPlans,
      totalDietPlans,
      activeMemberships,
      attendanceToday,
      revenueAgg,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null, role: Role.USER } }),
      prisma.user.count({ where: { deletedAt: null, role: Role.USER, createdAt: { gte: sevenDaysAgo } } }),
      prisma.exercise.count({ where: { deletedAt: null } }),
      prisma.workoutPlan.count({ where: { deletedAt: null } }),
      prisma.dietPlan.count({ where: { deletedAt: null } }),
      prisma.membership.count({ where: { status: 'ACTIVE', endDate: { gte: new Date() } } }),
      prisma.attendance.count({ where: { checkInAt: { gte: today } } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    ]);

    res.json({
      totalUsers,
      newUsersLast7Days,
      totalExercises,
      totalWorkoutPlans,
      totalDietPlans,
      activeMemberships,
      attendanceToday,
      totalRevenue: revenueAgg._sum.amount ?? 0,
    });
  })
);

// Trend data for the dashboard charts. `days` must be one of ANALYTICS_RANGES.
adminDashboardRouter.get(
  '/analytics',
  asyncHandler(async (req, res: Response) => {
    const days = Number(req.query.days ?? 30) as AnalyticsRange;
    if (!ANALYTICS_RANGES.includes(days)) {
      throw new AppError(`days must be one of ${ANALYTICS_RANGES.join(', ')}`, 422);
    }
    res.json(await getDashboardAnalytics(days));
  })
);
