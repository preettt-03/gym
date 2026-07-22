import webpush from 'web-push';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { prisma } from '@/lib/prisma';

const isConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (isConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export function isPushConfigured() {
  return isConfigured;
}

export function getVapidPublicKey() {
  return env.VAPID_PUBLIC_KEY ?? null;
}

// Best-effort, like emitToUser — a missing/misconfigured push setup or a
// stale subscription should never fail the request that triggered it (the
// underlying data, e.g. a Notification row, is already persisted).
export async function sendPushToUser(userId: string, payload: { title: string; body?: string; data?: unknown }) {
  if (!isConfigured) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const json = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked by the browser — clean it up.
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        } else {
          logger.error('Failed to send push notification', { err, userId });
        }
      }
    })
  );
}
