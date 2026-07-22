import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('AI features', () => {
  const email = uniqueTestEmail('ai');
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

  it('reports whether Gemini is configured', async () => {
    const res = await request(app).get('/api/v1/ai/status').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.configured).toBe('boolean');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/ai/status');
    expect(res.status).toBe(401);
  });

  it('degrades gracefully instead of crashing when Gemini is not configured', async () => {
    const status = await request(app).get('/api/v1/ai/status').set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app)
      .get('/api/v1/ai/motivation')
      .set('Authorization', `Bearer ${accessToken}`);

    if (status.body.configured) {
      // A real GEMINI_API_KEY is set — this environment can actually generate,
      // unless the free tier's request quota is already exhausted (a real,
      // expected condition when other tests/manual use hit the same key).
      if (res.status === 429) {
        expect(res.body.error.message).toMatch(/rate-limited/i);
      } else {
        expect(res.status).toBe(200);
        expect(typeof res.body.message).toBe('string');
      }
    } else {
      expect(res.status).toBe(503);
      expect(res.body.error.message).toMatch(/not configured/i);
    }
  });
});
