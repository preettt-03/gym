import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { sendReport } from '@/lib/export';
import * as service from '@/features/leaderboard/leaderboard.service';
import * as schemas from '@/features/leaderboard/leaderboard.schemas';

// Public, key-protected: /api/v1/leaderboard/display — the reception TV view.
export const leaderboardDisplayRouter = Router();

leaderboardDisplayRouter.get(
  '/',
  validate(schemas.displayQuerySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await service.getDisplayBoards(String(req.query.key)));
  })
);

// Member-facing: /api/v1/leaderboard
export const leaderboardRouter = Router();
leaderboardRouter.use(requireAuth);

leaderboardRouter.get(
  '/',
  validate(schemas.boardQuerySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { period, segment } = schemas.boardQuery.parse(req.query);
    res.json(await service.getPublicBoard(period, req.user!.id, segment));
  })
);

leaderboardRouter.post(
  '/high-fives',
  validate(schemas.highFiveSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.status(201).json(await service.giveHighFive(req.user!.id, req.body.toUserId, req.body.period));
  })
);

leaderboardRouter.get(
  '/hall-of-fame',
  validate(schemas.hallOfFameQuerySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { period } = schemas.hallOfFameQuery.parse(req.query);
    res.json({ cycles: await service.getHallOfFame(period) });
  })
);

leaderboardRouter.get(
  '/celebrations',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ celebrations: await service.listCelebrations(req.user!.id) });
  })
);

leaderboardRouter.post(
  '/celebrations/:id/seen',
  validate(schemas.awardIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.markCelebrated(req.user!.id, req.params.id);
    res.status(204).send();
  })
);

// Admin: /api/v1/admin/leaderboard
export const adminLeaderboardRouter = Router();
adminLeaderboardRouter.use(requireAuth, requireRole(Role.ADMIN));

adminLeaderboardRouter.get(
  '/',
  validate(schemas.boardQuerySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { period, offset } = schemas.boardQuery.parse(req.query);
    const { settings, range, entries } = await service.getAdminBoard(period, offset);
    res.json({ period, offset, range, settings, entries });
  })
);

adminLeaderboardRouter.get(
  '/export',
  validate(schemas.exportQuerySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { period, offset, format } = schemas.exportQuery.parse(req.query);
    const { range, entries } = await service.computeBoard(period, offset);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const headers = ['Rank', 'Member', 'Email', 'Phone', 'Points', 'Adjustments', 'Workouts', 'Gym visits', 'Calories', 'Gym minutes', 'Workout minutes', 'Streak days', 'Flags', 'Hidden'];
    const rows = entries.map((e) => [
      e.rank ?? '—',
      e.name,
      e.email,
      e.phone,
      e.points,
      e.adjustmentPoints,
      e.workouts,
      e.visits,
      e.caloriesBurned,
      e.gymMinutes,
      e.workoutMinutes,
      e.streakDays,
      e.flags.join(' '),
      e.hidden ? 'Yes' : 'No',
    ]);
    const label = period === 'all-time' ? 'all-time' : `${period}-${day(range.start)}`;
    await sendReport(res, format, `leaderboard-${label}`, `Leaderboard (${label})`, headers, rows);
  })
);

adminLeaderboardRouter.get(
  '/settings',
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ settings: await service.getSettings() });
  })
);

adminLeaderboardRouter.put(
  '/settings',
  validate(schemas.updateSettingsSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ settings: await service.updateSettings(req.body) });
  })
);

adminLeaderboardRouter.post(
  '/adjustments',
  validate(schemas.adjustmentSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const adjustment = await service.addAdjustment(req.user!.id, req.body.userId, req.body.points, req.body.reason);
    res.status(201).json({ adjustment });
  })
);

adminLeaderboardRouter.delete(
  '/adjustments/:id',
  validate(schemas.adjustmentIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.deleteAdjustment(req.params.id);
    res.status(204).send();
  })
);

adminLeaderboardRouter.get(
  '/members/:userId/adjustments',
  validate(schemas.userIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ adjustments: await service.listAdjustments(req.params.userId) });
  })
);

adminLeaderboardRouter.put(
  '/members/:userId/visibility',
  validate(schemas.visibilitySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.setVisibility(req.user!.id, req.params.userId, req.body.hidden, req.body.reason);
    res.json({ hidden: req.body.hidden });
  })
);

adminLeaderboardRouter.post(
  '/recalculate',
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    await service.invalidateCache();
    res.json({ message: 'Rankings will be recalculated on the next load' });
  })
);

adminLeaderboardRouter.put(
  '/display-key',
  validate(schemas.displayKeySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ settings: await service.setDisplayKey(req.body.enabled) });
  })
);

adminLeaderboardRouter.post(
  '/members/:userId/approve',
  validate(schemas.userIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.approveMember(req.user!.id, req.params.userId);
    res.json({ approved: true });
  })
);

adminLeaderboardRouter.get(
  '/snapshots',
  validate(schemas.snapshotsQuerySchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const period = req.query.period as 'daily' | 'weekly' | 'monthly' | undefined;
    res.json({ snapshots: await service.listSnapshots(period) });
  })
);

// Pays out any finished cycle that hasn't been closed yet (the scheduler does this every few minutes).
adminLeaderboardRouter.post(
  '/cycles/close',
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ closed: await service.closeFinishedCycles() });
  })
);
