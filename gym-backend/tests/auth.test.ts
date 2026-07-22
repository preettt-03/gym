import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('Auth flow', () => {
  const email = uniqueTestEmail('auth');
  const password = 'SuperSecret123';

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it('rejects registration with an invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueTestEmail('bad-pw'), password: 'short' });

    expect(res.status).toBe(422);
  });

  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'Jest Tester' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.isEmailVerified).toBe(false);
  });

  it('rejects login before email verification', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(403);
  });

  it('verifies the email with the OTP that was issued', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const code = await getLatestOtp(user.id);

    const res = await request(app).post('/api/v1/auth/verify-email').send({ email, code });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects verification with a wrong code', async () => {
    const otherEmail = uniqueTestEmail('wrong-code');
    await request(app).post('/api/v1/auth/register').send({ email: otherEmail, password });

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ email: otherEmail, code: '000000' });

    expect(res.status).toBe(400);
    await deleteTestUser(otherEmail);
  });

  it('logs in after verification and returns a usable access token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    const me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it('rejects login with the wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPassword123' });
    expect(res.status).toBe(401);
  });

  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a malformed token', async () => {
    const res = await request(app).get('/api/v1/users/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
