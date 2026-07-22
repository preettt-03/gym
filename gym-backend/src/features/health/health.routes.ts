import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    redis.ping().then(() => true).catch(() => false),
  ]);

  const healthy = dbOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    services: { database: dbOk, redis: redisOk },
    timestamp: new Date().toISOString(),
  });
});
