import { Response, Router } from 'express';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth } from '@/middlewares/auth';
import { createProgressPhotoSchema } from '@/features/progress-photos/progress-photos.schemas';
import * as service from '@/features/progress-photos/progress-photos.service';

export const progressPhotosRouter = Router();
progressPhotosRouter.use(requireAuth);

progressPhotosRouter.post(
  '/',
  validate(createProgressPhotoSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const photo = await service.createProgressPhoto(req.user!.id, req.body);
    res.status(201).json({ photo });
  })
);

progressPhotosRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const photos = await service.listProgressPhotos(req.user!.id);
    res.json({ photos });
  })
);
