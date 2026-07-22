import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import * as schemas from '@/features/segments/segments.schemas';
import * as service from '@/features/segments/segments.service';

export const segmentsRouter = Router();
segmentsRouter.use(requireAuth, requireRole(Role.ADMIN));

segmentsRouter.post(
  '/',
  validate(schemas.createSegmentSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { name, description, rules } = req.body;
    const segment = await service.createSegment(req.user!.id, name, description, rules);
    res.status(201).json({ segment });
  })
);

segmentsRouter.get(
  '/',
  asyncHandler(async (_req, res) => res.json({ segments: await service.listSegments() }))
);

segmentsRouter.get(
  '/:id',
  validate(schemas.idParamSchema),
  asyncHandler(async (req, res) => res.json({ segment: await service.getSegment(req.params.id) }))
);

segmentsRouter.delete(
  '/:id',
  validate(schemas.idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteSegment(req.params.id);
    res.status(204).send();
  })
);

segmentsRouter.get(
  '/:id/preview',
  validate(schemas.idParamSchema),
  asyncHandler(async (req, res) => res.json(await service.previewSegment(req.params.id)))
);

segmentsRouter.post(
  '/:id/assign-workout-plan',
  validate(schemas.assignPlanSchema),
  asyncHandler(async (req, res) =>
    res.json(await service.assignWorkoutPlanToSegment(req.params.id, req.body.planId))
  )
);

segmentsRouter.post(
  '/:id/assign-diet-plan',
  validate(schemas.assignPlanSchema),
  asyncHandler(async (req, res) => res.json(await service.assignDietPlanToSegment(req.params.id, req.body.planId)))
);

segmentsRouter.post(
  '/:id/notify',
  validate(schemas.notifySchema),
  asyncHandler(async (req, res) =>
    res.json(await service.notifySegment(req.params.id, req.body.title, req.body.body))
  )
);
