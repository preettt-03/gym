import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import * as schemas from '@/features/ai/ai.schemas';
import * as service from '@/features/ai/ai.service';

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.get(
  '/status',
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ configured: service.isAiConfigured() });
  })
);

aiRouter.post(
  '/workout-plan',
  validate(schemas.generateWorkoutPlanSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await service.generateWorkoutPlan(req.user!.id, req.body);
    res.json(result);
  })
);

aiRouter.post(
  '/diet-plan',
  validate(schemas.generateDietPlanSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await service.generateDietPlan(req.user!.id, req.body);
    res.json(result);
  })
);

aiRouter.post(
  '/form-tip',
  validate(schemas.formTipSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await service.getFormTip(req.user!.id, req.body.exerciseId);
    res.json(result);
  })
);

aiRouter.get(
  '/motivation',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await service.getMotivationMessage(req.user!.id);
    res.json(result);
  })
);

aiRouter.get(
  '/nutrition-suggestion',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await service.getNutritionSuggestion(req.user!.id);
    res.json(result);
  })
);

aiRouter.post(
  '/chat',
  validate(schemas.chatSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await service.chatWithCoach(req.user!.id, req.body.message);
    res.json(result);
  })
);

aiRouter.get(
  '/chat/history',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await service.listChatHistory(req.user!.id);
    res.json(result);
  })
);

aiRouter.delete(
  '/chat/history',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.clearChatHistory(req.user!.id);
    res.status(204).send();
  })
);

// --- Admin AI management ---

export const adminAiRouter = Router();
adminAiRouter.use(requireAuth, requireRole(Role.ADMIN));

adminAiRouter.get(
  '/settings',
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const settings = await service.getAiSettings();
    res.json({ settings, configured: service.isAiConfigured() });
  })
);

adminAiRouter.put(
  '/settings',
  validate(schemas.updateAiSettingsSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const settings = await service.updateAiSettings(req.body);
    res.json({ settings });
  })
);

adminAiRouter.get(
  '/logs',
  validate(schemas.listAiLogsSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { feature } = req.query as Record<string, string | undefined>;
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const result = await service.listAiLogs(
      feature as never,
      pagination.page,
      pagination.limit
    );
    res.json(result);
  })
);
