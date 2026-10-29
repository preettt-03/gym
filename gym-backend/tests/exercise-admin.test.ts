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

  const UP = 'http://localhost:8004/uploads';

  it('stores ordered photos and labelled videos, with the flagged photo as thumbnail', async () => {
    const res = await request(app)
      .post('/api/v1/admin/exercises')
      .set(as(admin))
      .send({
        name: tag,
        targetMuscle: 'Biceps',
        secondaryMuscles: ['Forearms', '  '],
        equipment: ['Dumbbells'],
        media: [
          { type: 'IMAGE', url: `${UP}/a.jpg` },
          { type: 'IMAGE', url: `${UP}/b.jpg`, isThumbnail: true, label: 'Top of the rep' },
          { type: 'VIDEO', url: `${UP}/front.mp4`, label: 'Front view' },
          { type: 'VIDEO', url: 'https://youtu.be/dQw4w9WgXcQ', label: '  ' },
        ],
        instructions: ['Stand tall', '', 'Curl up slowly'],
        commonMistakes: ['Swinging the hips'],
        coachTip: 'Squeeze at the top.',
      });
    expect(res.status).toBe(201);
    created.push(res.body.exercise.id);
    const ex = res.body.exercise;
    expect(ex).toMatchObject({
      secondaryMuscles: ['Forearms'],
      instructions: ['Stand tall', 'Curl up slowly'],
      coachTip: 'Squeeze at the top.',
      thumbnailUrl: `${UP}/b.jpg`,
      photoCount: 2,
      videoCount: 2,
    });
    expect(ex.media.map((m: { url: string; provider: string | null; label: string | null }) => [m.url, m.provider, m.label])).toEqual([
      [`${UP}/a.jpg`, null, null],
      [`${UP}/b.jpg`, null, 'Top of the rep'],
      [`${UP}/front.mp4`, 'upload', 'Front view'],
      ['https://youtu.be/dQw4w9WgXcQ', 'youtube', null],
    ]);
  });

  it('replaces the media list on edit and falls back to the first photo as thumbnail', async () => {
    const id = created[0];
    const res = await request(app)
      .patch(`/api/v1/admin/exercises/${id}`)
      .set(as(admin))
      .send({ media: [{ type: 'IMAGE', url: `${UP}/c.jpg` }, { type: 'IMAGE', url: `${UP}/a.jpg` }], coachTip: '', caloriesBurnedEstimate: null });
    expect(res.status).toBe(200);
    expect(res.body.exercise).toMatchObject({ thumbnailUrl: `${UP}/c.jpg`, videoCount: 0, photoCount: 2, coachTip: null, caloriesBurnedEstimate: null });
    expect(await prisma.exerciseMedia.count({ where: { exerciseId: id } })).toBe(2);

    const cleared = await request(app).patch(`/api/v1/admin/exercises/${id}`).set(as(admin)).send({ media: [] });
    expect(cleared.body.exercise).toMatchObject({ thumbnailUrl: null, media: [] });
  });

  it('rejects unsafe or invalid media and other bad input', async () => {
    const id = created[0];
    const send = (body: object) => request(app).patch(`/api/v1/admin/exercises/${id}`).set(as(admin)).send(body);

    expect((await send({ media: [{ type: 'VIDEO', url: 'https://evil.example.com/x.mp4' }] })).status).toBe(422);
    expect((await send({ media: [{ type: 'VIDEO', url: `${UP}/v.mp4`, isThumbnail: true }] })).status).toBe(422);
    expect(
      (await send({ media: [{ type: 'IMAGE', url: `${UP}/1.jpg`, isThumbnail: true }, { type: 'IMAGE', url: `${UP}/2.jpg`, isThumbnail: true }] })).status
    ).toBe(422);
    expect((await send({ media: Array.from({ length: 21 }, (_, i) => ({ type: 'IMAGE', url: `${UP}/${i}.jpg` })) })).status).toBe(422);
    expect((await send({ instructions: Array.from({ length: 21 }, (_, i) => `Step ${i}`) })).status).toBe(422);
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
