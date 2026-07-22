import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('Trainer portal', () => {
  const trainerEmail = uniqueTestEmail('trainer');
  const traineeEmail = uniqueTestEmail('trainee');
  const outsiderEmail = uniqueTestEmail('outsider-trainee');
  const password = 'SuperSecret123';
  let trainerToken: string;
  let traineeId: string;

  async function registerAndVerify(email: string) {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const code = await getLatestOtp(user.id);
    const res = await request(app).post('/api/v1/auth/verify-email').send({ email, code });
    return { userId: user.id, accessToken: res.body.accessToken as string };
  }

  beforeAll(async () => {
    const trainer = await registerAndVerify(trainerEmail);
    await prisma.user.update({ where: { id: trainer.userId }, data: { role: Role.TRAINER } });
    // Re-login to get a token whose JWT payload reflects the new role.
    const login = await request(app).post('/api/v1/auth/login').send({ email: trainerEmail, password });
    trainerToken = login.body.accessToken;

    const trainee = await registerAndVerify(traineeEmail);
    traineeId = trainee.userId;
    await prisma.user.update({ where: { id: traineeId }, data: { trainerId: trainer.userId } });

    await registerAndVerify(outsiderEmail);
  });

  afterAll(async () => {
    await deleteTestUser(trainerEmail);
    await deleteTestUser(traineeEmail);
    await deleteTestUser(outsiderEmail);
  });

  it('rejects a regular user from the trainer routes', async () => {
    const outsider = await request(app).post('/api/v1/auth/login').send({ email: outsiderEmail, password });
    const res = await request(app)
      .get('/api/v1/trainer/trainees')
      .set('Authorization', `Bearer ${outsider.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("lists the trainer's assigned trainee", async () => {
    const res = await request(app).get('/api/v1/trainer/trainees').set('Authorization', `Bearer ${trainerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.trainees.map((t: { id: string }) => t.id)).toContain(traineeId);
  });

  it('returns a dashboard-style overview for the trainee', async () => {
    const res = await request(app)
      .get(`/api/v1/trainer/trainees/${traineeId}/overview`)
      .set('Authorization', `Bearer ${trainerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.streak).toBeDefined();
  });

  it('blocks access to a trainee not assigned to this trainer', async () => {
    const outsider = await prisma.user.findUniqueOrThrow({ where: { email: outsiderEmail } });
    const res = await request(app)
      .get(`/api/v1/trainer/trainees/${outsider.id}/overview`)
      .set('Authorization', `Bearer ${trainerToken}`);
    expect(res.status).toBe(404);
  });

  it('sends a note that arrives as a real notification for the trainee', async () => {
    const res = await request(app)
      .post(`/api/v1/trainer/trainees/${traineeId}/notes`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ title: 'Test note', body: 'Keep it up' });
    expect(res.status).toBe(201);

    const traineeLogin = await request(app).post('/api/v1/auth/login').send({ email: traineeEmail, password });
    const notifications = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${traineeLogin.body.accessToken}`);

    expect(notifications.body.items.some((n: { title: string }) => n.title === 'Test note')).toBe(true);
  });

  it('assigns an existing admin workout plan to the trainee', async () => {
    const catalog = await request(app)
      .get('/api/v1/trainer/workout-plans')
      .set('Authorization', `Bearer ${trainerToken}`);
    expect(catalog.status).toBe(200);
    if (catalog.body.plans.length === 0) return;

    const planId = catalog.body.plans[0].id;
    const assignRes = await request(app)
      .post(`/api/v1/trainer/trainees/${traineeId}/assign-workout-plan`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ planId });
    expect(assignRes.status).toBe(204);

    const traineeLogin = await request(app).post('/api/v1/auth/login').send({ email: traineeEmail, password });
    const plans = await request(app)
      .get('/api/v1/workout-plans')
      .set('Authorization', `Bearer ${traineeLogin.body.accessToken}`);
    expect(plans.body.assignedPlans.some((p: { id: string }) => p.id === planId)).toBe(true);
  });
});
