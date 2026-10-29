import fs from 'node:fs/promises';
import { Request, Response, Router } from 'express';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AppError } from '@/middlewares/errorHandler';
import { AuthedRequest, requireAuth } from '@/middlewares/auth';
import { privateFilePath, privateImageUpload, verifyFileSignature } from '@/lib/private-files';
import { createProgressPhotoSchema, progressPhotoIdSchema } from '@/features/progress-photos/progress-photos.schemas';
import * as service from '@/features/progress-photos/progress-photos.service';

export const progressPhotosRouter = Router();

// Signed-URL file access. Registered before requireAuth because <img> tags can't
// send a bearer token — the signature (owner-issued, expires in an hour) is the auth.
progressPhotosRouter.get(
  '/file/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    if (!verifyFileSignature(key, req.query.expires, req.query.sig)) throw new AppError('Link expired or invalid', 403);

    const file = privateFilePath(key);
    await fs.access(file).catch(() => {
      throw new AppError('Photo not found', 404);
    });
    res.set({
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    res.sendFile(file);
  })
);

progressPhotosRouter.use(requireAuth);

progressPhotosRouter.post(
  '/',
  privateImageUpload.single('photo'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.file) throw new AppError('Choose a photo to upload', 400);
    // Validated here rather than via validate() so a rejected form doesn't leave the file behind.
    const parsed = createProgressPhotoSchema.shape.body.safeParse(req.body);
    if (!parsed.success) {
      await fs.unlink(req.file.path).catch(() => undefined);
      throw new AppError('Validation failed', 422, parsed.error.flatten().fieldErrors);
    }
    const photo = await service.createProgressPhoto(req.user!.id, req.file.filename, parsed.data);
    res.status(201).json({ photo });
  })
);

progressPhotosRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const photos = await service.listProgressPhotos(req.user!.id);
    res.set('Cache-Control', 'no-store');
    res.json({ photos });
  })
);

progressPhotosRouter.delete(
  '/:id',
  validate(progressPhotoIdSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.deleteProgressPhoto(req.user!.id, req.params.id);
    res.status(204).send();
  })
);
