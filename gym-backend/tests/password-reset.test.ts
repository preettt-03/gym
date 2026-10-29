import request from 'supertest';
import { OtpPurpose } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('Password reset and OTP hardening', () => {
  const email = uniqueTestEmail('reset');
  const password = 'OriginalPass123';
  const newPassword = 'BrandNewPass456';
  let userId: string;

  async function resetCodes() {
    return prisma.otpCode.findMany({
      where: { userId, purpose: OtpPurpose.PASSWORD_RESET },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Pushes the latest code outside the resend cooldown without waiting a minute.
  async function expireCooldown() {
    const [latest] = await resetCodes();
    await prisma.otpCode.update({
      where: { id: latest.id },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) },
    });
  }

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({ email, password, name: 'Reset Tester' });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userId = user.id;
    await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email, code: await getLatestOtp(userId) });
  });

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it('answers forgot-password identically for unknown emails', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: uniqueTestEmail('nobody') });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If the account exists/);
    expect(res.body.cooldownSeconds).toBe(60);
  });

  it('issues a reset code and enforces the resend cooldown', async () => {
    const first = await request(app).post('/api/v1/auth/forgot-password').send({ email });
    expect(first.status).toBe(200);
    expect(await resetCodes()).toHaveLength(1);

    const second = await request(app).post('/api/v1/auth/forgot-password').send({ email });
    expect(second.status).toBe(200);
    expect(await resetCodes()).toHaveLength(1);
  });

  it('burns a code after five wrong guesses', async () => {
    const code = await getLatestOtp(userId, OtpPurpose.PASSWORD_RESET);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email, code: wrong, newPassword });
      expect(res.status).toBe(400);
    }

    const fifth = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ email, code: wrong, newPassword });
    expect(fifth.status).toBe(400);
    expect(fifth.body.error.message).toMatch(/Too many incorrect attempts/);

    const correctButBurned = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ email, code, newPassword });
    expect(correctButBurned.status).toBe(400);
  });

  it('resets the password with a fresh code, revoking sessions and old codes', async () => {
    await expireCooldown();
    await request(app).post('/api/v1/auth/forgot-password').send({ email });
    const [superseded] = await resetCodes();

    // Requesting again must invalidate the code that was still active.
    await expireCooldown();
    await request(app).post('/api/v1/auth/forgot-password').send({ email });

    const codes = await resetCodes();
    expect(codes).toHaveLength(3);
    expect(codes.find((c) => c.id === superseded.id)?.consumedAt).not.toBeNull();
    expect(codes.filter((c) => c.consumedAt === null)).toHaveLength(1);

    const code = await getLatestOtp(userId, OtpPurpose.PASSWORD_RESET);
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ email, code, newPassword });
    expect(res.status).toBe(200);

    const liveSessions = await prisma.refreshToken.count({ where: { userId, revokedAt: null } });
    expect(liveSessions).toBe(0);

    const reused = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ email, code, newPassword: 'AnotherPass789' });
    expect(reused.status).toBe(400);

    const oldLogin = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/v1/auth/login').send({ email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it('does not send verification codes to an already-verified account', async () => {
    const before = await prisma.otpCode.count({ where: { userId, purpose: OtpPurpose.EMAIL_VERIFICATION } });
    const res = await request(app).post('/api/v1/auth/resend-otp').send({ email });

    expect(res.status).toBe(200);
    expect(await prisma.otpCode.count({ where: { userId, purpose: OtpPurpose.EMAIL_VERIFICATION } })).toBe(before);
  });
});
