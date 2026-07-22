import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import * as schemas from '@/features/notifications/notifications.schemas';
import * as service from '@/features/notifications/notifications.service';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  validate(schemas.listNotificationsSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const { unreadOnly } = req.query as Record<string, string | undefined>;
    res.json(await service.listMyNotifications(req.user!.id, pagination, unreadOnly === 'true'));
  })
);

notificationsRouter.post(
  '/:id/read',
  validate(schemas.notificationIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.markNotificationRead(req.user!.id, req.params.id);
    res.json({ message: 'Marked read' });
  })
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.markAllRead(req.user!.id);
    res.json({ message: 'All marked read' });
  })
);

export const adminNotificationsRouter = Router();
adminNotificationsRouter.use(requireAuth, requireRole(Role.ADMIN));

adminNotificationsRouter.post(
  '/broadcast',
  validate(schemas.broadcastSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { title, body, userIds } = req.body;
    res.status(201).json(await service.broadcastAnnouncement(title, body, userIds));
  })
);
