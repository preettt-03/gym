import fs from 'node:fs/promises';
import path from 'node:path';
import { ProgressPhoto } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { UPLOAD_DIR } from '@/lib/upload';
import { privateFilePath, signedFileUrl } from '@/lib/private-files';

export const PHOTO_FILE_ROUTE = '/api/v1/progress-photos/file';

// Callers only ever see a short-lived signed URL, never the storage key itself.
function present({ storageKey, photoUrl, ...photo }: ProgressPhoto) {
  return { ...photo, photoUrl: storageKey ? signedFileUrl(PHOTO_FILE_ROUTE, storageKey) : photoUrl };
}

export async function createProgressPhoto(userId: string, storageKey: string, data: { notes?: string; takenAt?: string }) {
  try {
    const photo = await prisma.progressPhoto.create({
      data: {
        userId,
        storageKey,
        notes: data.notes,
        takenAt: data.takenAt ? new Date(data.takenAt) : undefined,
      },
    });
    return present(photo);
  } catch (err) {
    await fs.unlink(privateFilePath(storageKey)).catch(() => undefined);
    throw err;
  }
}

export async function listProgressPhotos(userId: string) {
  const photos = await prisma.progressPhoto.findMany({ where: { userId }, orderBy: { takenAt: 'desc' } });
  return photos.map(present);
}

// Owner-only delete; also removes the file so a deleted photo doesn't linger on disk.
export async function deleteProgressPhoto(userId: string, id: string) {
  const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });
  if (!photo) throw new AppError('Photo not found', 404);

  await prisma.progressPhoto.delete({ where: { id } });

  if (photo.storageKey) {
    await fs.unlink(privateFilePath(photo.storageKey)).catch(() => undefined);
    return;
  }
  // Legacy rows point at the public uploads folder. basename() guards against path traversal.
  const match = photo.photoUrl?.match(/\/uploads\/([^/?#]+)$/);
  if (match) await fs.unlink(path.join(UPLOAD_DIR, path.basename(match[1]))).catch(() => undefined);
}
