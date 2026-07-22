import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('Admin route protection', () => {
  const email = uniqueTestEmail('regular-user');
  const password = 'SuperSecret123';
  let accessToken: string;

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const code = await getLatestOtp(user.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email, code });
    accessToken = verifyRes.body.accessToken;
  });

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it('blocks a regular user from an admin-only endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it('blocks a regular user from AI admin settings', async () => {
    const res = await request(app)
      .get('/api/v1/admin/ai/settings')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it('blocks unauthenticated access entirely', async () => {
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });
});
