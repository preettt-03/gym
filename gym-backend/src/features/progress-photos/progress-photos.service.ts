import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { UPLOAD_DIR } from '@/lib/upload';

export async function createProgressPhoto(
  userId: string,
  data: { photoUrl: string; notes?: string; takenAt?: string }
) {
  return prisma.progressPhoto.create({
    data: {
      userId,
      photoUrl: data.photoUrl,
      notes: data.notes,
      takenAt: data.takenAt ? new Date(data.takenAt) : undefined,
    },
  });
}

export async function listProgressPhotos(userId: string) {
  return prisma.progressPhoto.findMany({ where: { userId }, orderBy: { takenAt: 'desc' } });
}

// Owner-only delete. Also removes the uploaded file when it lives in our
// uploads folder, so a deleted progress photo doesn't linger on disk.
export async function deleteProgressPhoto(userId: string, id: string) {
  const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });
  if (!photo) throw new AppError('Photo not found', 404);

  await prisma.progressPhoto.delete({ where: { id } });

  const match = photo.photoUrl.match(/\/uploads\/([^/?#]+)$/);
  if (match) {
    // basename() guards against path traversal in a stored URL.
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(match[1]))).catch(() => undefined);
  }
}
