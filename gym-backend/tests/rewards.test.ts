import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Rewards store', () => {
  const emails = { admin: uniqueTestEmail('rw-admin'), rich: uniqueTestEmail('rw-rich'), poor: uniqueTestEmail('rw-poor') };
  const ids = { admin: '', rich: '', poor: '' };
  const tokens = { admin: '', rich: '', poor: '' };
  const itemIds: string[] = [];
  const as = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const coinsOf = async (who: keyof typeof ids) => (await prisma.user.findUniqueOrThrow({ where: { id: ids[who] } })).coins;
  const createItem = async (body: Record<string, unknown>) => {
    const res = await request(app).post('/api/v1/admin/rewards/items').set(as('admin')).send(body);
    expect(res.status).toBe(201);
    itemIds.push(res.body.item.id);
    return res.body.item as { id: string };
  };

  beforeAll(async () => {
    const setup = { admin: [Role.ADMIN, 0], rich: [Role.USER, 1000], poor: [Role.USER, 10] } as const;
    for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
      const [role, coins] = setup[key];
      const u = await prisma.user.create({ data: { email: emails[key], name: `Jest ${key}`, role, coins, isEmailVerified: true } });
      ids[key] = u.id;
      tokens[key] = signAccessToken({ sub: u.id, role });
    }
  });

  afterAll(async () => {
    await prisma.rewardRedemption.deleteMany({ where: { itemId: { in: itemIds } } });
    await prisma.rewardItem.deleteMany({ where: { id: { in: itemIds } } });
    for (const email of Object.values(emails)) await deleteTestUser(email);
  });

  it('spends coins, issues a front-desk code and takes stock', async () => {
    const shake = await createItem({ name: 'Jest protein shake', costCoins: 100, stock: 5 });
    const res = await request(app).post(`/api/v1/rewards/${shake.id}/redeem`).set(as('rich'));
    expect(res.status).toBe(201);
    expect(res.body.redemption.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(await coinsOf('rich')).toBe(900);
    expect((await prisma.rewardItem.findUniqueOrThrow({ where: { id: shake.id } })).stock).toBe(4);

    const store = await request(app).get('/api/v1/rewards').set(as('rich'));
    expect(store.body.coins).toBe(900);
    expect(store.body.items.find((i: { id: string }) => i.id === shake.id)).toMatchObject({ redeemedByMe: 1, canRedeem: true });
  });

  it('refuses when the member cannot afford it', async () => {
    const tee = await createItem({ name: 'Jest gym tee', costCoins: 500 });
    const res = await request(app).post(`/api/v1/rewards/${tee.id}/redeem`).set(as('poor'));
    expect(res.status).toBe(422);
    expect(await coinsOf('poor')).toBe(10);
    const store = await request(app).get('/api/v1/rewards').set(as('poor'));
    expect(store.body.items.find((i: { id: string }) => i.id === tee.id).blockedReason).toBe('NOT_ENOUGH_COINS');
  });

  it('never oversells the last item, even when two requests race', async () => {
    const last = await createItem({ name: 'Jest PT session', costCoins: 50, stock: 1 });
    const results = await Promise.all([1, 2].map(() => request(app).post(`/api/v1/rewards/${last.id}/redeem`).set(as('rich'))));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await prisma.rewardItem.findUniqueOrThrow({ where: { id: last.id } })).stock).toBe(0);
    expect(await prisma.rewardRedemption.count({ where: { itemId: last.id } })).toBe(1);
  });

  it('enforces the per-member limit', async () => {
    const once = await createItem({ name: 'Jest guest pass', costCoins: 10, maxPerMember: 1 });
    expect((await request(app).post(`/api/v1/rewards/${once.id}/redeem`).set(as('rich'))).status).toBe(201);
    expect((await request(app).post(`/api/v1/rewards/${once.id}/redeem`).set(as('rich'))).status).toBe(409);
  });

  it('refunds coins and stock when a pending redemption is cancelled', async () => {
    const towel = await createItem({ name: 'Jest towel', costCoins: 40, stock: 2 });
    const before = await coinsOf('rich');
    const { body } = await request(app).post(`/api/v1/rewards/${towel.id}/redeem`).set(as('rich'));
    expect(await coinsOf('rich')).toBe(before - 40);

    // Someone else can't cancel it.
    expect((await request(app).post(`/api/v1/rewards/redemptions/${body.redemption.id}/cancel`).set(as('poor'))).status).toBe(404);
    expect((await request(app).post(`/api/v1/rewards/redemptions/${body.redemption.id}/cancel`).set(as('rich'))).status).toBe(200);
    expect(await coinsOf('rich')).toBe(before);
    expect((await prisma.rewardItem.findUniqueOrThrow({ where: { id: towel.id } })).stock).toBe(2);
    expect((await request(app).post(`/api/v1/rewards/redemptions/${body.redemption.id}/cancel`).set(as('rich'))).status).toBe(409);
  });

  it('lets the front desk find a code and mark it given, and archives used items', async () => {
    const bar = await createItem({ name: 'Jest protein bar', costCoins: 20 });
    const { body } = await request(app).post(`/api/v1/rewards/${bar.id}/redeem`).set(as('rich'));
    const code = body.redemption.code as string;

    const found = await request(app).get(`/api/v1/admin/rewards/redemptions?code=${code.toLowerCase()}`).set(as('admin'));
    expect(found.body.items).toHaveLength(1);
    expect(found.body.items[0].user.email).toBe(emails.rich);

    expect((await request(app).post(`/api/v1/admin/rewards/redemptions/${body.redemption.id}/fulfill`).set(as('admin')).send({})).status).toBe(200);
    expect((await request(app).post(`/api/v1/admin/rewards/redemptions/${body.redemption.id}/cancel`).set(as('admin')).send({})).status).toBe(409);
    expect(await prisma.notification.count({ where: { userId: ids.rich, type: 'REWARD' } })).toBeGreaterThan(0);

    const del = await request(app).delete(`/api/v1/admin/rewards/items/${bar.id}`).set(as('admin'));
    expect(del.body.archived).toBe(true);
    const store = await request(app).get('/api/v1/rewards').set(as('rich'));
    expect(store.body.items.find((i: { id: string }) => i.id === bar.id)).toBeUndefined();
  });

  it('keeps item management for admins', async () => {
    expect((await request(app).post('/api/v1/admin/rewards/items').set(as('rich')).send({ name: 'x', costCoins: 1 })).status).toBe(403);
    expect((await request(app).get('/api/v1/rewards')).status).toBe(401);
  });
});
