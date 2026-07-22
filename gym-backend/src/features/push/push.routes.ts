import { Response, Router } from 'express';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth } from '@/middlewares/auth';
import { getVapidPublicKey, isPushConfigured } from '@/lib/push';
import * as schemas from '@/features/push/push.schemas';
import * as service from '@/features/push/push.service';

export const pushRouter = Router();

// Public — the frontend needs this before a user has even logged in to decide
// whether to show the "enable notifications" UI at all.
pushRouter.get(
  '/vapid-public-key',
  asyncHandler(async (_req, res: Response) => {
    res.json({ configured: isPushConfigured(), publicKey: getVapidPublicKey() });
  })
);

pushRouter.use(requireAuth);

pushRouter.post(
  '/subscribe',
  validate(schemas.subscribeSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const subscription = await service.subscribe(req.user!.id, req.body, req.headers['user-agent']);
    res.status(201).json({ subscription });
  })
);

pushRouter.post(
  '/unsubscribe',
  validate(schemas.unsubscribeSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.unsubscribe(req.user!.id, req.body.endpoint);
    res.status(204).send();
  })
);

pushRouter.get(
  '/subscriptions',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const subscriptions = await service.listMySubscriptions(req.user!.id);
    res.json({ subscriptions });
  })
);
