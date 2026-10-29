import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
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

  it('tells the member when no account exists for the email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: uniqueTestEmail('nobody'), password });
    expect(res.status).toBe(404);
    expect(res.body.error.details.code).toBe('USER_NOT_FOUND');
    expect(res.body.error.message).toBe('No user found with this account.');
  });

  it('locks an unknown email after three attempts as well', async () => {
    const nobody = uniqueTestEmail('nobody-locked');
    const attempt = () => request(app).post('/api/v1/auth/login').send({ email: nobody, password });
    expect((await attempt()).status).toBe(404);
    expect((await attempt()).status).toBe(404);
    const third = await attempt();
    expect(third.status).toBe(429);
    expect(third.body.error.details.code).toBe('LOGIN_LOCKED');
    await redis.del(`login:lock:${nobody}`);
  });

  it('counts down wrong passwords, then locks the account for 30 seconds', async () => {
    const wrong = () => request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPassword123' });

    const first = await wrong();
    expect(first.status).toBe(401);
    expect(first.body.error.details).toEqual({ code: 'WRONG_PASSWORD', attemptsLeft: 2 });
    expect((await wrong()).body.error.details.attemptsLeft).toBe(1);

    const third = await wrong();
    expect(third.status).toBe(429);
    expect(third.body.error.details).toEqual({ code: 'LOGIN_LOCKED', retryAfterSeconds: 30 });

    // Even the right password is refused while locked.
    const locked = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(locked.status).toBe(429);
    expect(locked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

    await redis.del(`login:lock:${email}`);
    expect((await request(app).post('/api/v1/auth/login').send({ email, password })).status).toBe(200);
  });

  it('resets the wrong-password count after a successful login', async () => {
    await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPassword123' });
    await request(app).post('/api/v1/auth/login').send({ email, password });
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPassword123' });
    expect(res.body.error.details.attemptsLeft).toBe(2);
    await redis.del(`login:fail:${email}`);
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
