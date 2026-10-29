import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Nutrition logs', () => {
  const email = uniqueTestEmail('nutrition');
  let token: string;
  let foodId: string;
  const as = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email, role: Role.USER, isEmailVerified: true } });
    token = signAccessToken({ sub: user.id, role: user.role });
    const food = await prisma.food.create({
      data: { name: `Jest Poha ${Date.now()}`, slug: `jest-poha-${Date.now()}`, caloriesPer100g: 130, proteinPer100g: 2.6, carbsPer100g: 23, fatPer100g: 3 },
    });
    foodId = food.id;
  });

  afterAll(async () => {
    await deleteTestUser(email);
    await prisma.food.delete({ where: { id: foodId } });
  });

  it('buckets entries by Indian calendar day, not server UTC', async () => {
    // 00:30 IST on 10 March is still 9 March in UTC.
    const res = await request(app)
      .post('/api/v1/nutrition-logs')
      .set(as())
      .send({ foodId, quantityGrams: 150, mealType: 'BREAKFAST', loggedAt: '2026-03-09T19:00:00.000Z' });
    expect(res.status).toBe(201);

    const march10 = await request(app).get('/api/v1/nutrition-logs').query({ date: '2026-03-10' }).set(as());
    expect(march10.body.date).toBe('2026-03-10');
    expect(march10.body.entries).toHaveLength(1);
    expect(march10.body.totals.calories).toBeCloseTo(195, 0);

    const march9 = await request(app).get('/api/v1/nutrition-logs').query({ date: '2026-03-09' }).set(as());
    expect(march9.body.entries).toHaveLength(0);
  });

  it('rejects unrealistic quantities, future timestamps and malformed dates', async () => {
    const tooMuch = await request(app).post('/api/v1/nutrition-logs').set(as()).send({ foodId, quantityGrams: 6000 });
    expect(tooMuch.status).toBe(422);

    const future = await request(app)
      .post('/api/v1/nutrition-logs')
      .set(as())
      .send({ foodId, quantityGrams: 100, loggedAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(future.status).toBe(422);

    const badDate = await request(app).get('/api/v1/nutrition-logs').query({ date: 'yesterday' }).set(as());
    expect(badDate.status).toBe(422);
  });
});
