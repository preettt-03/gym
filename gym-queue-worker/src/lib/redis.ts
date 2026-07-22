import IORedis from 'ioredis';
import { env } from '@/config/env';

// BullMQ requires maxRetriesPerRequest: null on the connection it's given.
export const bullConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Separate connection for publishing cross-process notification events —
// gym-backend subscribes to this channel to push realtime socket events,
// since this worker runs in its own process and has no access to the
// backend's in-memory Socket.IO instance.
export const publisher = new IORedis(env.REDIS_URL);

export const NOTIFICATION_CHANNEL = 'gym:notification:new';
