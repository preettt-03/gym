import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

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

// Lets the caller verify their own subscription actually works end-to-end
// (VAPID keys + browser permission + service worker) without waiting for a
// real system event to trigger one.
export async function sendTestPush(userId: string) {
  const subscriptionCount = await prisma.pushSubscription.count({ where: { userId } });
  await sendPushToUser(userId, {
    title: 'Test notification',
    body: 'If you can see this, push notifications are working.',
  });
  return { subscriptionCount };
}
