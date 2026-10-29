import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { OtpPurpose } from '@prisma/client';
import { hashOtp } from '@/lib/otp';

export const app = createApp();

// Real integration tests hit real Postgres — every test user is created with
// this prefix so afterAll hooks can find and delete exactly what they made
// without touching seeded/dev data.
export const TEST_EMAIL_PREFIX = 'jest-test-';

export function uniqueTestEmail(label: string) {
  return `${TEST_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Only a keyed hash of each OTP is stored, so tests can't read the emailed code
// back. Instead they pin the latest OTP to a code derived from its id (stable,
// so repeated calls agree) and get that code back to submit.
export async function getLatestOtp(userId: string, purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION) {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new Error(`No OTP found for user ${userId}`);
  const code = String(parseInt(createHash('sha256').update(otp.id).digest('hex').slice(0, 8), 16) % 1_000_000).padStart(6, '0');
  await prisma.otpCode.update({ where: { id: otp.id }, data: { codeHash: hashOtp(code) } });
  return code;
}

export async function deleteTestUser(email: string) {
  await prisma.user.deleteMany({ where: { email } });
}
