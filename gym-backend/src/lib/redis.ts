import Redis from 'ioredis';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

export const redis = new Redis(env.REDIS_URL);

redis.on('error', (err) => logger.error('Redis connection error', { err }));
redis.on('connect', () => logger.info('Redis connected'));
