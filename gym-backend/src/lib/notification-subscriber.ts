import Redis from 'ioredis';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { emitToUser } from '@/lib/socket';
import { sendPushToUser } from '@/lib/push';

// Must match gym-queue-worker's NOTIFICATION_CHANNEL constant exactly.
const NOTIFICATION_CHANNEL = 'gym:notification:new';

// The queue-worker runs as a separate process and has no access to this process's
// in-memory Socket.IO instance, so it publishes here via Redis pub/sub instead of
// calling emitToUser directly. This bridges background jobs to realtime clients.
export function startNotificationSubscriber() {
  const subscriber = new Redis(env.REDIS_URL);

  subscriber.subscribe(NOTIFICATION_CHANNEL, (err) => {
    if (err) {
      logger.error('Failed to subscribe to notification channel', { err });
      return;
    }
    logger.info(`Subscribed to ${NOTIFICATION_CHANNEL}`);
  });

  subscriber.on('message', (channel, message) => {
    if (channel !== NOTIFICATION_CHANNEL) return;
    try {
      const { userId, notification } = JSON.parse(message);
      emitToUser(userId, 'notification:new', notification);
      sendPushToUser(userId, { title: notification.title, body: notification.body }).catch((err) =>
        logger.error('sendPushToUser failed', { err, userId })
      );
    } catch (err) {
      logger.error('Failed to process notification event', { err });
    }
  });

  return subscriber;
}
