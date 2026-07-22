import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import * as schemas from '@/features/attendance/attendance.schemas';
import * as service from '@/features/attendance/attendance.service';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

attendanceRouter.post(
  '/check-in',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const attendance = await service.checkIn(req.user!.id);
    res.status(201).json({ attendance });
  })
);

attendanceRouter.post(
  '/check-out',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const attendance = await service.checkOut(req.user!.id);
    res.json({ attendance });
  })
);

attendanceRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ items: await service.listMyAttendance(req.user!.id) });
  })
);

attendanceRouter.get(
  '/status',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json(await service.getCurrentStatus(req.user!.id));
  })
);

export const adminAttendanceRouter = Router();
adminAttendanceRouter.use(requireAuth, requireRole(Role.ADMIN));

adminAttendanceRouter.post(
  '/check-in',
  validate(schemas.adminCheckInSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const attendance = await service.adminCheckIn(req.user!.id, req.body.userId);
    res.status(201).json({ attendance });
  })
);

adminAttendanceRouter.get(
  '/',
  validate(schemas.listAttendanceSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    res.json(await service.listAllAttendance(pagination));
  })
);
