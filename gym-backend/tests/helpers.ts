import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { OtpPurpose } from '@prisma/client';

export const app = createApp();

// Real integration tests hit real Postgres — every test user is created with
// this prefix so afterAll hooks can find and delete exactly what they made
// without touching seeded/dev data.
export const TEST_EMAIL_PREFIX = 'jest-test-';

export function uniqueTestEmail(label: string) {
  return `${TEST_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Registration only queues an OTP email (or logs it to console if SMTP isn't
// configured) — reading the code straight from the DB is more reliable than
// parsing logs and works the same whether or not SMTP is configured.
export async function getLatestOtp(userId: string, purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION) {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new Error(`No OTP found for user ${userId}`);
  return otp.code;
}

export async function deleteTestUser(email: string) {
  await prisma.user.deleteMany({ where: { email } });
}
