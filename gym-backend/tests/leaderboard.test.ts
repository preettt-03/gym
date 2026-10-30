import request from 'supertest';
import { Gender, LeaderboardSettings, Prisma, Role } from '@prisma/client';
import { redis } from '@/lib/redis';
import * as service from '@/features/leaderboard/leaderboard.service';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { gymPeriodRange } from '@/lib/gym-time';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

const WEIGHTS = {
  isEnabled: true,
  workoutPoints: 50,
  visitPoints: 30,
  caloriesPerPoint: 10,
  gymMinutePoints: 1,
  workoutMinutePoints: 2,
  streakPoints: 25,
  fraudDetection: true,
  maxWorkoutsPerDay: 3,
  maxCaloriesPerDay: 3000,
  maxGymMinutesPerVisit: 300,
  autoFreeze: false,
  overtakeAlerts: true,
  weeklyWrapUp: true,
  rewards: {
    daily: { enabled: true, coins: [50, 30, 20], xp: [100, 60, 40] },
    weekly: { enabled: true, coins: [300, 200, 100], xp: [600, 400, 200] },
    monthly: { enabled: true, coins: [1000, 600, 300], xp: [2000, 1200, 600] },
  },
};
// Cycle tests run on dates nobody else has data for, so they never snapshot real periods.
const OLD_DAY = new Date('2001-01-01T05:00:00Z'); // Mon 1 Jan 2001, 10:30 IST

describe('gymPeriodRange', () => {
  it('starts weeks on Monday and days at IST midnight', () => {
    // Wednesday 2026-10-28, 10:00 IST
    const now = new Date('2026-10-28T04:30:00Z');
    expect(gymPeriodRange('weekly', 0, now).start.toISOString()).toBe('2026-10-25T18:30:00.000Z'); // Mon 26th 00:00 IST
    expect(gymPeriodRange('weekly', 1, now).start.toISOString()).toBe('2026-10-18T18:30:00.000Z');
    expect(gymPeriodRange('daily', 0, now).end.toISOString()).toBe('2026-10-28T18:30:00.000Z');
    expect(gymPeriodRange('monthly', 0, now).start.toISOString()).toBe('2026-09-30T18:30:00.000Z'); // 1 Oct IST
    expect(gymPeriodRange('monthly', 1, now).start.toISOString()).toBe('2026-08-31T18:30:00.000Z'); // 1 Sep IST
  });
});

describe('Leaderboard', () => {
  const emails = { admin: uniqueTestEmail('lb-admin'), alpha: uniqueTestEmail('lb-alpha'), beta: uniqueTestEmail('lb-beta') };
  const ids = { admin: '', alpha: '', beta: '' };
  const tokens = { admin: '', alpha: '', beta: '' };
  let original: LeaderboardSettings | null;

  const board = (token: string, period = 'daily') =>
    request(app).get(`/api/v1/leaderboard?period=${period}`).set('Authorization', `Bearer ${token}`);
  const adminBoard = () => request(app).get('/api/v1/admin/leaderboard?period=daily').set('Authorization', `Bearer ${tokens.admin}`);
  const asAdmin = (method: 'put' | 'post', path: string, body?: object) =>
    request(app)[method](`/api/v1/admin/leaderboard${path}`).set('Authorization', `Bearer ${tokens.admin}`).send(body);
  const entryFor = (entries: { userId: string }[], id: string) => entries.find((e) => e.userId === id) as Record<string, unknown> | undefined;

  beforeAll(async () => {
    original = await prisma.leaderboardSettings.findUnique({ where: { id: 'default' } });
    await prisma.leaderboardSettings.upsert({ where: { id: 'default' }, update: WEIGHTS, create: { id: 'default', ...WEIGHTS } });
    await prisma.leaderboardSnapshot.deleteMany({ where: { periodStart: { lt: new Date('2002-01-01') } } });

    const roles = { admin: Role.ADMIN, alpha: Role.USER, beta: Role.USER };
    for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
      const u = await prisma.user.create({ data: { email: emails[key], name: `Jest LB ${key}`, role: roles[key], isEmailVerified: true } });
      ids[key] = u.id;
    }
    tokens.admin = signAccessToken({ sub: ids.admin, role: Role.ADMIN });
    tokens.alpha = signAccessToken({ sub: ids.alpha, role: Role.USER });
    tokens.beta = signAccessToken({ sub: ids.beta, role: Role.USER });
    await prisma.user.update({ where: { id: ids.alpha }, data: { gender: Gender.FEMALE } });
    await prisma.user.update({ where: { id: ids.beta }, data: { gender: Gender.MALE } });

    // Alpha: two finished workouts (300 kcal, 20 min) and a 60-minute visit.
    const exercise = await prisma.exercise.findFirstOrThrow();
    const now = new Date();
    for (let i = 0; i < 2; i++) {
      await prisma.workoutLog.create({
        data: {
          userId: ids.alpha,
          completedAt: now,
          exerciseLogs: { create: { exerciseId: exercise.id, caloriesBurned: 150, durationSeconds: 600, completedAt: now } },
        },
      });
    }
    await prisma.attendance.create({ data: { userId: ids.alpha, checkInAt: now, checkOutAt: now, durationMinutes: 60 } });
    // Beta: one 30-minute visit.
    await prisma.attendance.create({ data: { userId: ids.beta, checkInAt: now, checkOutAt: now, durationMinutes: 30 } });
    // Alpha alone in an old day, for cycle-close tests.
    await prisma.attendance.create({ data: { userId: ids.alpha, checkInAt: OLD_DAY, checkOutAt: OLD_DAY, durationMinutes: 45 } });
    await service.invalidateCache();
  });

  afterAll(async () => {
    await prisma.leaderboardSnapshot.deleteMany({ where: { periodStart: { lt: new Date('2002-01-01') } } });
    if (original) {
      const { id: _id, updatedAt: _u, rewards, ...rest } = original;
      await prisma.leaderboardSettings.update({ where: { id: 'default' }, data: { ...rest, rewards: rewards as Prisma.InputJsonValue } });
    } else {
      await prisma.leaderboardSettings.deleteMany({ where: { id: 'default' } });
    }
    for (const email of Object.values(emails)) await deleteTestUser(email);
    await service.invalidateCache();
  });

  it('scores overall activity and ranks members against each other', async () => {
    const res = await board(tokens.alpha);
    expect(res.status).toBe(200);

    const alpha = entryFor(res.body.entries, ids.alpha)!;
    const beta = entryFor(res.body.entries, ids.beta)!;
    // 2×50 workouts + 1×30 visit + 300/10 kcal + 60×1 gym min + 20×2 workout min
    expect(alpha.points).toBe(100 + 30 + 30 + 60 + 40);
    expect(beta.points).toBe(30 + 30);
    expect(alpha.rank as number).toBeLessThan(beta.rank as number);
    expect(res.body.me.rank).toBe(alpha.rank);
  });

  it('serves every period, including all-time, to members and admins', async () => {
    for (const period of ['daily', 'weekly', 'monthly', 'all-time']) {
      const res = await board(tokens.alpha, period);
      expect(res.status).toBe(200);
      expect(entryFor(res.body.entries, ids.alpha)).toBeDefined();
      const admin = await request(app).get(`/api/v1/admin/leaderboard?period=${period}`).set('Authorization', `Bearer ${tokens.admin}`);
      expect(admin.status).toBe(200);
    }
    const csv = await request(app).get('/api/v1/admin/leaderboard/export?period=all-time').set('Authorization', `Bearer ${tokens.admin}`);
    expect(csv.status).toBe(200);
  });

  it('never shows contact details or admin-only fields to members', async () => {
    const res = await board(tokens.alpha);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(emails.alpha);
    expect(entryFor(res.body.entries, ids.alpha)).not.toHaveProperty('flags');
  });

  it('applies manual adjustments, and they can be undone', async () => {
    const add = await request(app)
      .post('/api/v1/admin/leaderboard/adjustments')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ userId: ids.beta, points: 500, reason: 'Won the plank challenge' });
    expect(add.status).toBe(201);

    let beta = entryFor((await board(tokens.alpha)).body.entries, ids.beta)!;
    expect(beta.points).toBe(560);
    expect(beta.rank as number).toBeLessThan(entryFor((await board(tokens.alpha)).body.entries, ids.alpha)!.rank as number);

    const del = await request(app).delete(`/api/v1/admin/leaderboard/adjustments/${add.body.adjustment.id}`).set('Authorization', `Bearer ${tokens.admin}`);
    expect(del.status).toBe(204);
    beta = entryFor((await board(tokens.alpha)).body.entries, ids.beta)!;
    expect(beta.points).toBe(60);
  });

  it('flags implausible logs for admins when fraud detection is on', async () => {
    await request(app).put('/api/v1/admin/leaderboard/settings').set('Authorization', `Bearer ${tokens.admin}`).send({ maxWorkoutsPerDay: 1 });
    const res = await adminBoard();
    expect(entryFor(res.body.entries, ids.alpha)!.flags).toContain('TOO_MANY_WORKOUTS');
    await request(app).put('/api/v1/admin/leaderboard/settings').set('Authorization', `Bearer ${tokens.admin}`).send({ maxWorkoutsPerDay: 3 });
  });

  it('hides a disqualified member from the public board but not from admins', async () => {
    const hide = await request(app)
      .put(`/api/v1/admin/leaderboard/members/${ids.alpha}/visibility`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ hidden: true, reason: 'Duplicate workout logs' });
    expect(hide.status).toBe(200);

    expect(entryFor((await board(tokens.alpha)).body.entries, ids.alpha)).toBeUndefined();
    const adminEntry = entryFor((await adminBoard()).body.entries, ids.alpha)!;
    expect(adminEntry.hidden).toBe(true);
    expect(adminEntry.rank).toBeNull();
    expect(adminEntry.hiddenReason).toBe('Duplicate workout logs');

    await request(app).put(`/api/v1/admin/leaderboard/members/${ids.alpha}/visibility`).set('Authorization', `Bearer ${tokens.admin}`).send({ hidden: false });
    expect(entryFor((await board(tokens.alpha)).body.entries, ids.alpha)).toBeDefined();
  });

  it('ranks within a segment for fairer competition', async () => {
    const women = await request(app).get('/api/v1/leaderboard?period=daily&segment=women').set('Authorization', `Bearer ${tokens.alpha}`);
    expect(women.status).toBe(200);
    expect(entryFor(women.body.entries, ids.alpha)).toBeDefined();
    expect(entryFor(women.body.entries, ids.beta)).toBeUndefined();
    const men = await request(app).get('/api/v1/leaderboard?period=daily&segment=men').set('Authorization', `Bearer ${tokens.alpha}`);
    expect(entryFor(men.body.entries, ids.beta)).toBeDefined();
    expect(men.body.me.rank).toBeNull();
  });

  it('auto-freezes flagged members until an admin approves them', async () => {
    await asAdmin('put', '/settings', { autoFreeze: true, maxWorkoutsPerDay: 1 });
    expect(entryFor((await board(tokens.alpha)).body.entries, ids.alpha)).toBeUndefined();
    const frozen = entryFor((await adminBoard()).body.entries, ids.alpha)!;
    expect(frozen.frozen).toBe(true);
    expect(frozen.rank).toBeNull();

    expect((await asAdmin('post', `/members/${ids.alpha}/approve`)).status).toBe(200);
    expect(entryFor((await board(tokens.alpha)).body.entries, ids.alpha)).toBeDefined();

    await asAdmin('put', '/settings', { autoFreeze: false, maxWorkoutsPerDay: 3 });
    await prisma.leaderboardClearance.deleteMany({ where: { userId: ids.alpha } });
    await service.invalidateCache();
  });

  it('lets members high-five each other once per board', async () => {
    const give = () =>
      request(app).post('/api/v1/leaderboard/high-fives').set('Authorization', `Bearer ${tokens.alpha}`).send({ toUserId: ids.beta, period: 'daily' });
    expect((await give()).body.count).toBe(1);
    expect((await give()).body.count).toBe(1);

    const beta = entryFor((await board(tokens.alpha)).body.entries, ids.beta)!;
    expect(beta.highFives).toBe(1);
    expect(beta.highFivedByMe).toBe(true);

    const self = await request(app).post('/api/v1/leaderboard/high-fives').set('Authorization', `Bearer ${tokens.alpha}`).send({ toUserId: ids.alpha });
    expect(self.status).toBe(422);
    expect(await prisma.notification.count({ where: { userId: ids.beta, type: 'LEADERBOARD' } })).toBeGreaterThan(0);
  });

  it('closes a finished cycle once, pays the winner and queues a celebration', async () => {
    const coinsBefore = (await prisma.user.findUniqueOrThrow({ where: { id: ids.alpha } })).coins;
    const now = new Date('2001-01-02T06:00:00Z'); // the next day

    await service.closeFinishedCycles(now);
    await service.closeFinishedCycles(now); // idempotent

    const snapshot = await prisma.leaderboardSnapshot.findFirstOrThrow({ where: { period: 'daily', periodStart: new Date('2000-12-31T18:30:00Z') }, include: { awards: true } });
    expect(snapshot.awards).toHaveLength(1);
    expect(snapshot.awards[0]).toMatchObject({ userId: ids.alpha, rank: 1, coins: 50, xp: 100, badgeName: 'Gold Champion' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.alpha } })).coins).toBe(coinsBefore + 50);
    expect(await prisma.userBadge.count({ where: { userId: ids.alpha, badge: { name: 'Gold Champion' } } })).toBe(1);

    const celebrations = await request(app).get('/api/v1/leaderboard/celebrations').set('Authorization', `Bearer ${tokens.alpha}`);
    expect(celebrations.body.celebrations).toEqual([expect.objectContaining({ rank: 1, period: 'daily', coins: 50 })]);
    const id = celebrations.body.celebrations[0].id;
    expect((await request(app).post(`/api/v1/leaderboard/celebrations/${id}/seen`).set('Authorization', `Bearer ${tokens.beta}`)).status).toBe(404);
    expect((await request(app).post(`/api/v1/leaderboard/celebrations/${id}/seen`).set('Authorization', `Bearer ${tokens.alpha}`)).status).toBe(204);
    expect((await request(app).get('/api/v1/leaderboard/celebrations').set('Authorization', `Bearer ${tokens.alpha}`)).body.celebrations).toEqual([]);
  });

  it('lists finished cycles in the Hall of Fame', async () => {
    const res = await request(app).get('/api/v1/leaderboard/hall-of-fame?period=daily').set('Authorization', `Bearer ${tokens.beta}`);
    expect(res.status).toBe(200);
    const day = res.body.cycles.find((c: { periodStart: string }) => c.periodStart === '2000-12-31T18:30:00.000Z');
    expect(day.podium[0]).toMatchObject({ userId: ids.alpha, rank: 1 });
    expect(JSON.stringify(day)).not.toContain(emails.alpha);
  });

  it('tells a member when someone climbs past them', async () => {
    const weekly = (await board(tokens.alpha, 'weekly')).body.entries;
    const a = entryFor(weekly, ids.alpha)!.rank as number;
    const b = entryFor(weekly, ids.beta)!.rank as number;
    expect(a).toBeLessThan(b);
    // Last check: beta was where alpha is now.
    const key = `lb:ranks:weekly:${gymPeriodRange('weekly', 0).start.toISOString()}`;
    await redis.hset(key, { [ids.beta]: String(a), [ids.alpha]: String(b) });
    await redis.del(`lb:overtake:${ids.beta}:${new Date().toISOString().slice(0, 10)}`);

    await service.sendOvertakeAlerts();
    const alert = await prisma.notification.findFirst({ where: { userId: ids.beta, title: { contains: 'just took' } } });
    expect(alert?.title).toBe(`Jest LB alpha just took #${a} from you!`);
  });

  it('serves the reception TV view only with the right key', async () => {
    const on = await asAdmin('put', '/display-key', { enabled: true });
    const key = on.body.settings.displayKey as string;
    expect(key.length).toBeGreaterThan(10);

    expect((await request(app).get('/api/v1/leaderboard/display?key=wrong-key-1234')).status).toBe(404);
    const tv = await request(app).get(`/api/v1/leaderboard/display?key=${key}`);
    expect(tv.status).toBe(200);
    expect(tv.body.boards.map((b: { period: string }) => b.period)).toEqual(['daily', 'weekly']);
    expect(JSON.stringify(tv.body)).not.toContain(emails.alpha);
    expect(JSON.stringify(tv.body)).not.toContain('Jest LB alpha');

    await asAdmin('put', '/display-key', { enabled: false });
    expect((await request(app).get(`/api/v1/leaderboard/display?key=${key}`)).status).toBe(404);
  });

  it('can switch the member board off', async () => {
    await request(app).put('/api/v1/admin/leaderboard/settings').set('Authorization', `Bearer ${tokens.admin}`).send({ isEnabled: false });
    const res = await board(tokens.alpha);
    expect(res.body.enabled).toBe(false);
    expect(res.body.entries).toEqual([]);
    await request(app).put('/api/v1/admin/leaderboard/settings').set('Authorization', `Bearer ${tokens.admin}`).send({ isEnabled: true });
  });

  it('exports the board as CSV', async () => {
    const res = await request(app).get('/api/v1/admin/leaderboard/export?period=daily&format=csv').set('Authorization', `Bearer ${tokens.admin}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Jest LB alpha');
  });

  it('rejects bad input and keeps admin routes for admins', async () => {
    expect((await board(tokens.alpha, 'yearly')).status).toBe(422);
    expect((await request(app).get('/api/v1/admin/leaderboard').set('Authorization', `Bearer ${tokens.alpha}`)).status).toBe(403);
    expect((await request(app).get('/api/v1/leaderboard')).status).toBe(401);
  });
});
