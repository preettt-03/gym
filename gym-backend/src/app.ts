import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from '@/docs/openapi';
import { env } from '@/config/env';
import { UPLOAD_DIR } from '@/lib/upload';
import { globalRateLimiter } from '@/middlewares/rateLimiter';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';
import { healthRouter } from '@/features/health/health.routes';
import { authRouter } from '@/features/auth/auth.routes';
import { usersRouter } from '@/features/users/users.routes';
import { adminExercisesRouter, exercisesRouter } from '@/features/exercises/exercises.routes';
import {
  adminExerciseCategoriesRouter,
  exerciseCategoriesRouter,
} from '@/features/exercise-categories/exercise-categories.routes';
import {
  adminWorkoutPlansRouter,
  workoutLogsRouter,
  workoutPlansRouter,
} from '@/features/workout-plans/workout-plans.routes';
import { progressPhotosRouter } from '@/features/progress-photos/progress-photos.routes';
import { adminToolsRouter, toolsRouter } from '@/features/tools/tools.routes';
import {
  adminDietCategoriesRouter,
  dietCategoriesRouter,
} from '@/features/diet-categories/diet-categories.routes';
import { adminFoodsRouter, foodsRouter } from '@/features/foods/foods.routes';
import { adminDietPlansRouter, dietPlansRouter } from '@/features/diet-plans/diet-plans.routes';
import { nutritionLogsRouter } from '@/features/nutrition-logs/nutrition-logs.routes';
import { calculatorsRouter } from '@/features/calculators/calculators.routes';
import {
  adminMembershipPlansRouter,
  membershipPlansRouter,
} from '@/features/membership-plans/membership-plans.routes';
import { membershipsRouter } from '@/features/memberships/memberships.routes';
import { paymentsRouter } from '@/features/payments/payments.routes';
import { adminAttendanceRouter, attendanceRouter } from '@/features/attendance/attendance.routes';
import { streaksRouter } from '@/features/streaks/streaks.routes';
import { adminBadgesRouter, badgesRouter } from '@/features/badges/badges.routes';
import { adminMissionsRouter, missionsRouter } from '@/features/missions/missions.routes';
import { adminLeaderboardRouter, leaderboardDisplayRouter, leaderboardRouter } from '@/features/leaderboard/leaderboard.routes';
import { adminRewardsRouter, rewardsRouter } from '@/features/rewards/rewards.routes';
import { adminUsersRouter } from '@/features/admin-users/admin-users.routes';
import { adminMemberCrmRouter } from '@/features/admin-users/member-crm.routes';
import { adminDashboardRouter } from '@/features/admin-dashboard/admin-dashboard.routes';
import { adminChatRouter, chatRouter, publicChatRouter } from '@/features/chat/chat.routes';
import { adminNotificationsRouter, notificationsRouter } from '@/features/notifications/notifications.routes';
import { uploadsRouter } from '@/features/uploads/uploads.routes';
import { adminCmsRouter, cmsRouter } from '@/features/cms/cms.routes';
import { auditLogsRouter } from '@/features/audit-logs/audit-logs.routes';
import { reportsRouter } from '@/features/reports/reports.routes';
import { segmentsRouter } from '@/features/segments/segments.routes';
import { adminAiRouter, aiRouter } from '@/features/ai/ai.routes';
import { trainerRouter } from '@/features/trainer/trainer.routes';
import { pushRouter } from '@/features/push/push.routes';
import { webhooksRouter } from '@/features/webhooks/webhooks.routes';
import { auditLog } from '@/middlewares/auditLog';

const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) {
    const hops = Number(env.TRUST_PROXY);
    app.set('trust proxy', Number.isInteger(hops) ? hops : env.TRUST_PROXY);
  }

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  app.use(compression());

  // Mounted before the global json() parser below — it needs the raw request
  // body to verify Razorpay's webhook signature.
  app.use('/api/v1/webhooks', webhooksRouter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Helmet's default same-origin CORP would block the frontend apps (different ports)
  // from loading these images, so relax it specifically for this static route.
  // Served ahead of the rate limiter so image-heavy pages don't eat the API budget.
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(UPLOAD_DIR)
  );

  app.use(globalRateLimiter);

  // Applies to every /api/v1/admin/* mutation regardless of which router below handles
  // it — req.user is populated by the specific router's requireAuth by the time the
  // response actually finishes, so this doesn't need its own auth check.
  app.use('/api/v1/admin', auditLog);

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/exercises', exercisesRouter);
  app.use('/api/v1/exercise-categories', exerciseCategoriesRouter);
  app.use('/api/v1/admin/exercises', adminExercisesRouter);
  app.use('/api/v1/admin/exercise-categories', adminExerciseCategoriesRouter);
  app.use('/api/v1/workout-plans', workoutPlansRouter);
  app.use('/api/v1/workout-logs', workoutLogsRouter);
  app.use('/api/v1/admin/workout-plans', adminWorkoutPlansRouter);
  app.use('/api/v1/progress-photos', progressPhotosRouter);
  app.use('/api/v1/tools', toolsRouter);
  app.use('/api/v1/admin/tools', adminToolsRouter);
  app.use('/api/v1/diet-categories', dietCategoriesRouter);
  app.use('/api/v1/admin/diet-categories', adminDietCategoriesRouter);
  app.use('/api/v1/foods', foodsRouter);
  app.use('/api/v1/admin/foods', adminFoodsRouter);
  app.use('/api/v1/diet-plans', dietPlansRouter);
  app.use('/api/v1/admin/diet-plans', adminDietPlansRouter);
  app.use('/api/v1/nutrition-logs', nutritionLogsRouter);
  app.use('/api/v1/calculators', calculatorsRouter);
  app.use('/api/v1/membership-plans', membershipPlansRouter);
  app.use('/api/v1/admin/membership-plans', adminMembershipPlansRouter);
  app.use('/api/v1/memberships', membershipsRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/admin/attendance', adminAttendanceRouter);
  app.use('/api/v1/streaks', streaksRouter);
  app.use('/api/v1/badges', badgesRouter);
  app.use('/api/v1/admin/badges', adminBadgesRouter);
  app.use('/api/v1/missions', missionsRouter);
  app.use('/api/v1/admin/missions', adminMissionsRouter);
  // Before leaderboardRouter, whose requireAuth would otherwise claim this path.
  app.use('/api/v1/leaderboard/display', leaderboardDisplayRouter);
  app.use('/api/v1/leaderboard', leaderboardRouter);
  app.use('/api/v1/admin/leaderboard', adminLeaderboardRouter);
  app.use('/api/v1/rewards', rewardsRouter);
  app.use('/api/v1/admin/rewards', adminRewardsRouter);
  app.use('/api/v1/admin/users', adminUsersRouter);
  app.use('/api/v1/admin/users', adminMemberCrmRouter);
  app.use('/api/v1/admin/dashboard', adminDashboardRouter);
  // Before chatRouter, whose requireAuth would otherwise claim these paths.
  app.use('/api/v1/chat/public', publicChatRouter);
  app.use('/api/v1/chat', chatRouter);
  app.use('/api/v1/admin/chat', adminChatRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/admin/notifications', adminNotificationsRouter);
  app.use('/api/v1/uploads', uploadsRouter);
  app.use('/api/v1/cms', cmsRouter);
  app.use('/api/v1/admin/cms', adminCmsRouter);
  app.use('/api/v1/admin/audit-logs', auditLogsRouter);
  app.use('/api/v1/admin/reports', reportsRouter);
  app.use('/api/v1/admin/segments', segmentsRouter);
  app.use('/api/v1/ai', aiRouter);
  app.use('/api/v1/admin/ai', adminAiRouter);
  app.use('/api/v1/trainer', trainerRouter);
  app.use('/api/v1/push', pushRouter);

  const openApiSpec = buildOpenApiSpec([
    { prefix: '/api/v1/health', router: healthRouter, tag: 'Health' },
    { prefix: '/api/v1/auth', router: authRouter, tag: 'Auth' },
    { prefix: '/api/v1/users', router: usersRouter, tag: 'Users' },
    { prefix: '/api/v1/exercises', router: exercisesRouter, tag: 'Exercises' },
    { prefix: '/api/v1/exercise-categories', router: exerciseCategoriesRouter, tag: 'Exercises' },
    { prefix: '/api/v1/admin/exercises', router: adminExercisesRouter, tag: 'Admin: Exercises' },
    {
      prefix: '/api/v1/admin/exercise-categories',
      router: adminExerciseCategoriesRouter,
      tag: 'Admin: Exercises',
    },
    { prefix: '/api/v1/workout-plans', router: workoutPlansRouter, tag: 'Workout Plans' },
    { prefix: '/api/v1/workout-logs', router: workoutLogsRouter, tag: 'Workout Plans' },
    { prefix: '/api/v1/admin/workout-plans', router: adminWorkoutPlansRouter, tag: 'Admin: Workout Plans' },
    { prefix: '/api/v1/progress-photos', router: progressPhotosRouter, tag: 'Progress' },
    { prefix: '/api/v1/tools', router: toolsRouter, tag: 'Tools' },
    { prefix: '/api/v1/admin/tools', router: adminToolsRouter, tag: 'Admin: Tools' },
    { prefix: '/api/v1/diet-categories', router: dietCategoriesRouter, tag: 'Diet Plans' },
    { prefix: '/api/v1/admin/diet-categories', router: adminDietCategoriesRouter, tag: 'Admin: Diet Plans' },
    { prefix: '/api/v1/foods', router: foodsRouter, tag: 'Diet Plans' },
    { prefix: '/api/v1/admin/foods', router: adminFoodsRouter, tag: 'Admin: Diet Plans' },
    { prefix: '/api/v1/diet-plans', router: dietPlansRouter, tag: 'Diet Plans' },
    { prefix: '/api/v1/admin/diet-plans', router: adminDietPlansRouter, tag: 'Admin: Diet Plans' },
    { prefix: '/api/v1/nutrition-logs', router: nutritionLogsRouter, tag: 'Nutrition' },
    { prefix: '/api/v1/calculators', router: calculatorsRouter, tag: 'Nutrition' },
    { prefix: '/api/v1/membership-plans', router: membershipPlansRouter, tag: 'Membership' },
    {
      prefix: '/api/v1/admin/membership-plans',
      router: adminMembershipPlansRouter,
      tag: 'Admin: Membership',
    },
    { prefix: '/api/v1/memberships', router: membershipsRouter, tag: 'Membership' },
    { prefix: '/api/v1/payments', router: paymentsRouter, tag: 'Membership' },
    { prefix: '/api/v1/attendance', router: attendanceRouter, tag: 'Attendance' },
    { prefix: '/api/v1/admin/attendance', router: adminAttendanceRouter, tag: 'Admin: Attendance' },
    { prefix: '/api/v1/streaks', router: streaksRouter, tag: 'Gamification' },
    { prefix: '/api/v1/badges', router: badgesRouter, tag: 'Gamification' },
    { prefix: '/api/v1/admin/badges', router: adminBadgesRouter, tag: 'Admin: Gamification' },
    { prefix: '/api/v1/missions', router: missionsRouter, tag: 'Gamification' },
    { prefix: '/api/v1/admin/missions', router: adminMissionsRouter, tag: 'Admin: Gamification' },
    { prefix: '/api/v1/leaderboard/display', router: leaderboardDisplayRouter, tag: 'Gamification' },
    { prefix: '/api/v1/leaderboard', router: leaderboardRouter, tag: 'Gamification' },
    { prefix: '/api/v1/admin/leaderboard', router: adminLeaderboardRouter, tag: 'Admin: Gamification' },
    { prefix: '/api/v1/rewards', router: rewardsRouter, tag: 'Gamification' },
    { prefix: '/api/v1/admin/rewards', router: adminRewardsRouter, tag: 'Admin: Gamification' },
    { prefix: '/api/v1/admin/users', router: adminUsersRouter, tag: 'Admin: Users' },
    { prefix: '/api/v1/admin/users', router: adminMemberCrmRouter, tag: 'Admin: Member CRM' },
    { prefix: '/api/v1/admin/dashboard', router: adminDashboardRouter, tag: 'Admin: Dashboard' },
    { prefix: '/api/v1/chat/public', router: publicChatRouter, tag: 'Chat' },
    { prefix: '/api/v1/chat', router: chatRouter, tag: 'Chat' },
    { prefix: '/api/v1/admin/chat', router: adminChatRouter, tag: 'Admin: Chat' },
    { prefix: '/api/v1/notifications', router: notificationsRouter, tag: 'Notifications' },
    { prefix: '/api/v1/admin/notifications', router: adminNotificationsRouter, tag: 'Admin: Notifications' },
    { prefix: '/api/v1/uploads', router: uploadsRouter, tag: 'Uploads' },
    { prefix: '/api/v1/cms', router: cmsRouter, tag: 'CMS' },
    { prefix: '/api/v1/admin/cms', router: adminCmsRouter, tag: 'Admin: CMS' },
    { prefix: '/api/v1/admin/audit-logs', router: auditLogsRouter, tag: 'Admin: Audit Logs' },
    { prefix: '/api/v1/admin/reports', router: reportsRouter, tag: 'Admin: Reports' },
    { prefix: '/api/v1/admin/segments', router: segmentsRouter, tag: 'Admin: Segments' },
    { prefix: '/api/v1/ai', router: aiRouter, tag: 'AI' },
    { prefix: '/api/v1/admin/ai', router: adminAiRouter, tag: 'Admin: AI' },
    { prefix: '/api/v1/trainer', router: trainerRouter, tag: 'Trainer' },
    { prefix: '/api/v1/push', router: pushRouter, tag: 'Push Notifications' },
    { prefix: '/api/v1/webhooks', router: webhooksRouter, tag: 'Webhooks' },
  ]);

  app.get('/api-docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
