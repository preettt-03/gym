import { prisma } from '@/lib/prisma';

export async function subscribe(
  userId: string,
  data: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    update: { userId, p256dh: data.keys.p256dh, auth: data.keys.auth, userAgent },
    create: {
      userId,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      userAgent,
    },
  });
}

export async function unsubscribe(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function listMySubscriptions(userId: string) {
  return prisma.pushSubscription.findMany({ where: { userId }, select: { id: true, endpoint: true, createdAt: true } });
}
