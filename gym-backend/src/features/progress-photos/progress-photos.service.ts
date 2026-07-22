import { prisma } from '@/lib/prisma';

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
