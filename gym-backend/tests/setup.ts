import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

// Tests must never send real email, whatever SMTP settings .env contains.
// Individual tests can still override this (see mail-failure.test.ts).
jest.mock('@/lib/mailer', () => ({ sendMail: jest.fn().mockResolvedValue(undefined) }));

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});
