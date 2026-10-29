import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Body-fat calculator', () => {
  const post = (body: Record<string, unknown>) => request(app).post('/api/v1/calculators/body-fat').send(body);

  it('estimates with the Navy method and reports a category', async () => {
    const res = await post({ gender: 'MALE', heightCm: 178, neckCm: 38, waistCm: 85 });
    expect(res.status).toBe(200);
    expect(res.body.bodyFatPercent).toBeGreaterThan(10);
    expect(res.body.bodyFatPercent).toBeLessThan(25);
    expect(res.body.method).toMatch(/Navy/);
    expect(typeof res.body.category).toBe('string');
  });

  it('requires a hip measurement for women instead of crashing', async () => {
    const res = await post({ gender: 'FEMALE', heightCm: 165, neckCm: 32, waistCm: 72 });
    expect(res.status).toBe(422);
  });

  it('rejects a waist smaller than the neck instead of returning NaN', async () => {
    const res = await post({ gender: 'MALE', heightCm: 178, neckCm: 45, waistCm: 44 });
    expect(res.status).toBe(422);
  });

  it('rejects out-of-range measurements', async () => {
    const res = await post({ gender: 'MALE', heightCm: 20, neckCm: 38, waistCm: 85 });
    expect(res.status).toBe(422);
  });
});

describe('Favourite and recently viewed exercises', () => {
  const email = uniqueTestEmail('favorites');
  const otherEmail = uniqueTestEmail('favorites-other');
  let token: string;
  let otherToken: string;
  let exercises: { id: string; slug: string }[];
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email, role: Role.USER, isEmailVerified: true } });
    const other = await prisma.user.create({ data: { email: otherEmail, role: Role.USER, isEmailVerified: true } });
    token = signAccessToken({ sub: user.id, role: user.role });
    otherToken = signAccessToken({ sub: other.id, role: other.role });
    exercises = await prisma.exercise.findMany({ where: { deletedAt: null }, take: 3, select: { id: true, slug: true } });
    if (exercises.length < 3) throw new Error('Seed the DB (npm run prisma:seed) before running tests.');
  });

  afterAll(async () => {
    await deleteTestUser(email);
    await deleteTestUser(otherEmail);
  });

  it('favouriting is idempotent and private to the member', async () => {
    const [first] = exercises;
    const a = await request(app).put(`/api/v1/exercises/${first.id}/favorite`).set(as(token));
    const b = await request(app).put(`/api/v1/exercises/${first.id}/favorite`).set(as(token));
    expect(a.body.favorited).toBe(true);
    expect(b.status).toBe(200);

    const mine = await request(app).get('/api/v1/exercises/favorites').set(as(token));
    expect(mine.body.items.map((e: { id: string }) => e.id)).toEqual([first.id]);

    const theirs = await request(app).get('/api/v1/exercises/favorites').set(as(otherToken));
    expect(theirs.body.items).toEqual([]);

    await request(app).delete(`/api/v1/exercises/${first.id}/favorite`).set(as(token));
    const twice = await request(app).delete(`/api/v1/exercises/${first.id}/favorite`).set(as(token));
    expect(twice.body.favorited).toBe(false);
    expect((await request(app).get('/api/v1/exercises/favorites').set(as(token))).body.items).toEqual([]);
  });

  it('404s when favouriting an unknown exercise', async () => {
    const res = await request(app)
      .put('/api/v1/exercises/00000000-0000-4000-8000-000000000000/favorite')
      .set(as(token));
    expect(res.status).toBe(404);
  });

  it('lists distinct recently viewed exercises, newest first, and can be cleared', async () => {
    const [a, b, c] = exercises;
    for (const slug of [a.slug, b.slug, a.slug, c.slug, a.slug]) {
      await request(app).get(`/api/v1/exercises/${slug}`).set(as(token));
    }

    const recent = await request(app).get('/api/v1/exercises/recent').set(as(token));
    expect(recent.body.items.map((e: { id: string }) => e.id)).toEqual([a.id, c.id, b.id]);

    // Repeat views within the dedupe window don't add rows.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.exerciseView.count({ where: { userId: user.id } })).toBe(3);

    expect((await request(app).delete('/api/v1/exercises/recent').set(as(token))).status).toBe(204);
    expect((await request(app).get('/api/v1/exercises/recent').set(as(token))).body.items).toEqual([]);
  });

  it('requires login for favourites and history', async () => {
    expect((await request(app).get('/api/v1/exercises/favorites')).status).toBe(401);
    expect((await request(app).delete('/api/v1/exercises/recent')).status).toBe(401);
  });
});
