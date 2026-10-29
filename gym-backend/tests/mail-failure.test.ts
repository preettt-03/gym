import request from 'supertest';
import { Role } from '@prisma/client';
import * as mailer from '@/lib/mailer';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

// When the mail server is unreachable, self-service flows must still succeed
// (the user can resend) while an admin-triggered reset reports the failure.
describe('Email delivery failures', () => {
  const email = uniqueTestEmail('mail-down');
  const adminEmail = uniqueTestEmail('mail-down-admin');
  let sendMail: jest.SpyInstance;

  beforeAll(() => {
    sendMail = jest.spyOn(mailer, 'sendMail').mockRejectedValue(new Error('getaddrinfo EAI_AGAIN smtp.example.com'));
  });

  afterAll(async () => {
    sendMail.mockResolvedValue(undefined);
    await deleteTestUser(email);
    await deleteTestUser(adminEmail);
  });

  it('still registers the user and stores a code they can use', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'SuperSecret123' });
    expect(res.status).toBe(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const verify = await request(app).post('/api/v1/auth/verify-email').send({ email, code: await getLatestOtp(user.id) });
    expect(verify.status).toBe(200);
  });

  it('tells the admin when a reset email could not be sent', async () => {
    const admin = await prisma.user.create({ data: { email: adminEmail, role: Role.ADMIN, isEmailVerified: true } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email } });

    const res = await request(app)
      .post(`/api/v1/admin/users/${member.id}/reset-password`)
      .set('Authorization', `Bearer ${signAccessToken({ sub: admin.id, role: admin.role })}`);
    expect(res.status).toBe(502);
    // Sessions are only revoked once the email actually went out.
    expect(await prisma.refreshToken.count({ where: { userId: member.id, revokedAt: null } })).toBeGreaterThan(0);
  });
});
