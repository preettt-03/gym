import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Mission progress', () => {
  const email = uniqueTestEmail('missions');
  const adminEmail = uniqueTestEmail('missions-admin');
  let token: string;
  let userId: string;
  let missionId: string;

  beforeAll(async () => {
    const admin = await prisma.user.create({ data: { email: adminEmail, role: Role.ADMIN, isEmailVerified: true } });
    const user = await prisma.user.create({ data: { email, role: Role.USER, isEmailVerified: true } });
    userId = user.id;
    token = signAccessToken({ sub: user.id, role: user.role });
    const mission = await prisma.mission.create({
      data: {
        title: `Jest water ${Date.now()}`,
        conditionType: 'DRINK_WATER',
        targetValue: 3,
        rewardCoins: 10,
        rewardXp: 25,
        startDate: new Date(Date.now() - 60_000),
        endDate: new Date(Date.now() + 86_400_000),
        createdByAdminId: admin.id,
      },
    });
    missionId = mission.id;
  });

  afterAll(async () => {
    await deleteTestUser(email);
    if (missionId) await prisma.mission.delete({ where: { id: missionId } });
    await deleteTestUser(adminEmail);
  });

  it('pays the reward exactly once when concurrent reports cross the target', async () => {
    const post = () =>
      request(app).post(`/api/v1/missions/${missionId}/progress`).set('Authorization', `Bearer ${token}`).send({ value: 2 });
    const results = await Promise.all([post(), post(), post()]);
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);

    const progress = await prisma.userMissionProgress.findUniqueOrThrow({ where: { userId_missionId: { userId, missionId } } });
    expect(progress.currentValue).toBe(6);
    expect(progress.isCompleted).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.coins).toBe(10);
    expect(user.xp).toBe(25);
  });

  it('rejects absurd progress values', async () => {
    const res = await request(app)
      .post(`/api/v1/missions/${missionId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1_000_000 });
    expect(res.status).toBe(422);
  });
});
