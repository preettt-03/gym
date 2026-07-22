import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});
