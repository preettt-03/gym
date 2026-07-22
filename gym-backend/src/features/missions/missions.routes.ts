import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/missions/missions.service';
import * as schemas from '@/features/missions/missions.schemas';

// User-facing: /api/v1/missions
export const missionsRouter = Router();
missionsRouter.use(requireAuth);

missionsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ missions: await controller.listActiveMissionsForUser(req.user!.id) });
  })
);

missionsRouter.post(
  '/:id/progress',
  validate(schemas.reportProgressSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const progress = await controller.reportProgress(req.user!.id, req.params.id, req.body.value);
    res.json({ progress });
  })
);

// Admin: /api/v1/admin/missions
export const adminMissionsRouter = Router();
adminMissionsRouter.use(requireAuth, requireRole(Role.ADMIN));

adminMissionsRouter.post(
  '/',
  validate(schemas.createMissionSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const mission = await controller.createMission(req.user!.id, req.body);
    res.status(201).json({ mission });
  })
);

adminMissionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => res.json({ missions: await controller.listAdminMissions() }))
);

adminMissionsRouter.patch(
  '/:id',
  validate(schemas.updateMissionSchema),
  asyncHandler(async (req, res) => res.json({ mission: await controller.updateMission(req.params.id, req.body) }))
);

adminMissionsRouter.delete(
  '/:id',
  validate(schemas.missionIdParamSchema),
  asyncHandler(async (req, res) => {
    await controller.deleteMission(req.params.id);
    res.status(204).send();
  })
);
