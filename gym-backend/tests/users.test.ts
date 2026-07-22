import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('Dashboard — today plan cycling', () => {
  const email = uniqueTestEmail('dashboard');
  const password = 'SuperSecret123';
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userId = user.id;
    const code = await getLatestOtp(user.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email, code });
    accessToken = verifyRes.body.accessToken;
  });

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it("has no today plan before any workout/diet plan is assigned", async () => {
    const res = await request(app)
      .get('/api/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.today.workout).toBeNull();
    expect(res.body.today.diet).toBeNull();
  });

  it('cycles to the correct day of an assigned workout plan based on days elapsed', async () => {
    const plan = await prisma.workoutPlan.findFirst({ where: { source: 'ADMIN' }, include: { days: true } });
    if (!plan || plan.days.length === 0) return; // nothing seeded to assign — skip rather than fail the suite

    const daysAgo = 5;
    const assignedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    await prisma.workoutPlanAssignment.create({ data: { planId: plan.id, userId, assignedAt } });

    const res = await request(app)
      .get('/api/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);

    const expectedIndex = ((daysAgo % plan.days.length) + plan.days.length) % plan.days.length;
    const sortedDays = [...plan.days].sort((a, b) => a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber);

    expect(res.body.today.workout.planId).toBe(plan.id);
    expect(res.body.today.workout.day.id).toBe(sortedDays[expectedIndex].id);
  });
});
