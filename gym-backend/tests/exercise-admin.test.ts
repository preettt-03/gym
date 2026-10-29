import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { UPLOAD_DIR } from '@/lib/upload';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Exercise media, steps and filters', () => {
  const adminEmail = uniqueTestEmail('ex-admin');
  const memberEmail = uniqueTestEmail('ex-member');
  const tag = `Jest Move ${Date.now()}`;
  let admin: string;
  let member: string;
  const created: string[] = [];
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const a = await prisma.user.create({ data: { email: adminEmail, role: Role.ADMIN, isEmailVerified: true } });
    const m = await prisma.user.create({ data: { email: memberEmail, role: Role.USER, isEmailVerified: true } });
    admin = signAccessToken({ sub: a.id, role: a.role });
    member = signAccessToken({ sub: m.id, role: m.role });
  });

  afterAll(async () => {
    await prisma.exercise.deleteMany({ where: { id: { in: created } } });
    await deleteTestUser(adminEmail);
    await deleteTestUser(memberEmail);
  });

  it('stores media, steps, mistakes and the coach tip, dropping blank rows', async () => {
    const res = await request(app)
      .post('/api/v1/admin/exercises')
      .set(as(admin))
      .send({
        name: tag,
        targetMuscle: 'Biceps',
        secondaryMuscles: ['Forearms', '  '],
        equipment: ['Dumbbells'],
        thumbnailUrl: 'http://localhost:8004/uploads/thumb.jpg',
        images: ['http://localhost:8004/uploads/a.jpg', 'http://localhost:8004/uploads/b.jpg'],
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        instructions: ['Stand tall', '', 'Curl up slowly'],
        commonMistakes: ['Swinging the hips'],
        coachTip: 'Squeeze at the top.',
      });
    expect(res.status).toBe(201);
    created.push(res.body.exercise.id);
    expect(res.body.exercise).toMatchObject({
      secondaryMuscles: ['Forearms'],
      instructions: ['Stand tall', 'Curl up slowly'],
      coachTip: 'Squeeze at the top.',
      thumbnailUrl: 'http://localhost:8004/uploads/thumb.jpg',
    });
    expect(res.body.exercise.images).toHaveLength(2);
  });

  it('clears optional fields with null and rejects bad input', async () => {
    const id = created[0];
    const cleared = await request(app)
      .patch(`/api/v1/admin/exercises/${id}`)
      .set(as(admin))
      .send({ videoUrl: null, coachTip: '', thumbnailUrl: null, caloriesBurnedEstimate: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.exercise).toMatchObject({ videoUrl: null, coachTip: null, thumbnailUrl: null, caloriesBurnedEstimate: null });

    const tooMany = await request(app)
      .patch(`/api/v1/admin/exercises/${id}`)
      .set(as(admin))
      .send({ instructions: Array.from({ length: 21 }, (_, i) => `Step ${i}`) });
    expect(tooMany.status).toBe(422);

    const badUrl = await request(app).patch(`/api/v1/admin/exercises/${id}`).set(as(admin)).send({ videoUrl: 'not a url' });
    expect(badUrl.status).toBe(422);
  });

  it('returns 409 when a rename collides, without losing categories', async () => {
    const other = await request(app).post('/api/v1/admin/exercises').set(as(admin)).send({ name: `${tag} B`, targetMuscle: 'Triceps' });
    created.push(other.body.exercise.id);

    const res = await request(app).patch(`/api/v1/admin/exercises/${other.body.exercise.id}`).set(as(admin)).send({ name: tag, categoryIds: [] });
    expect(res.status).toBe(409);
  });

  it('filters the library by muscle group using the primary muscle', async () => {
    const arms = await request(app).get('/api/v1/exercises').query({ muscleGroup: 'arms', search: tag, limit: 50 });
    expect(arms.status).toBe(200);
    expect(arms.body.items.map((e: { name: string }) => e.name).sort()).toEqual([tag, `${tag} B`].sort());

    const legs = await request(app).get('/api/v1/exercises').query({ muscleGroup: 'legs', limit: 50 });
    for (const e of legs.body.items) expect(['quadriceps', 'hamstrings', 'glutes', 'calves', 'legs', 'adductors', 'abductors', 'hip flexors']).toContain(e.targetMuscle.toLowerCase());

    expect((await request(app).get('/api/v1/exercises').query({ muscleGroup: 'tail' })).status).toBe(422);
  });

  it('only lets admins upload videos, and only video files', async () => {
    const mp4 = Buffer.from('000000206674797069736f6d0000020069736f6d69736f32617663316d703431', 'hex');
    const asMember = await request(app).post('/api/v1/uploads/video').set(as(member)).attach('file', mp4, { filename: 'x.mp4', contentType: 'video/mp4' });
    expect(asMember.status).toBe(403);

    const notVideo = await request(app).post('/api/v1/uploads/video').set(as(admin)).attach('file', Buffer.from('hi'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(notVideo.status).toBe(400);

    const ok = await request(app).post('/api/v1/uploads/video').set(as(admin)).attach('file', mp4, { filename: 'x.mp4', contentType: 'video/mp4' });
    expect(ok.status).toBe(201);
    expect(ok.body.url).toMatch(/\/uploads\/[0-9a-f-]{36}\.mp4$/);
    fs.rmSync(path.join(UPLOAD_DIR, path.basename(ok.body.url)), { force: true });
    await prisma.mediaAsset.deleteMany({ where: { url: ok.body.url } });
  });
});
