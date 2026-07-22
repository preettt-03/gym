import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('Workout plans (authenticated)', () => {
  const email = uniqueTestEmail('workout');
  const password = 'SuperSecret123';
  let accessToken: string;
  let exerciseId: string;
  let createdPlanId: string;

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const code = await getLatestOtp(user.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email, code });
    accessToken = verifyRes.body.accessToken;

    const exercisesRes = await request(app).get('/api/v1/exercises').query({ limit: '1' });
    if (!exercisesRes.body.items?.length) {
      throw new Error('No exercises in the database to build a test plan from — seed the DB before running tests.');
    }
    exerciseId = exercisesRes.body.items[0].id;
  });

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/workout-plans');
    expect(res.status).toBe(401);
  });

  it('starts with no custom plans', async () => {
    const res = await request(app)
      .get('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ownedPlans).toEqual([]);
  });

  it('creates a custom plan referencing a real exercise', async () => {
    const res = await request(app)
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Jest Test Plan',
        difficulty: 'BEGINNER',
        days: [
          {
            weekNumber: 1,
            dayNumber: 1,
            isRestDay: false,
            exercises: [{ exerciseId, targetSets: 3, targetReps: 10 }],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.plan.title).toBe('Jest Test Plan');
    expect(res.body.plan.days).toHaveLength(1);
    createdPlanId = res.body.plan.id;
  });

  it('rejects a plan with no days', async () => {
    const res = await request(app)
      .post('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Invalid Plan', difficulty: 'BEGINNER', days: [] });

    expect(res.status).toBe(422);
  });

  it('lists the created plan', async () => {
    const res = await request(app)
      .get('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ownedPlans.map((p: { id: string }) => p.id)).toContain(createdPlanId);
  });

  it("prevents a different user from reading another user's plan", async () => {
    const otherEmail = uniqueTestEmail('workout-intruder');
    await request(app).post('/api/v1/auth/register').send({ email: otherEmail, password });
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { email: otherEmail } });
    const code = await getLatestOtp(otherUser.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email: otherEmail, code });

    const res = await request(app)
      .get(`/api/v1/workout-plans/${createdPlanId}`)
      .set('Authorization', `Bearer ${verifyRes.body.accessToken}`);

    expect(res.status).toBe(403);
    await deleteTestUser(otherEmail);
  });

  it('deletes the created plan', async () => {
    const res = await request(app)
      .delete(`/api/v1/workout-plans/${createdPlanId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
  });
});
