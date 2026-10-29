import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Progress photos and weight logs', () => {
  const ownerEmail = uniqueTestEmail('photos-owner');
  const otherEmail = uniqueTestEmail('photos-other');
  let owner: string;
  let other: string;

  beforeAll(async () => {
    const a = await prisma.user.create({ data: { email: ownerEmail, role: Role.USER, isEmailVerified: true } });
    const b = await prisma.user.create({ data: { email: otherEmail, role: Role.USER, isEmailVerified: true } });
    owner = signAccessToken({ sub: a.id, role: a.role });
    other = signAccessToken({ sub: b.id, role: b.role });
  });

  afterAll(async () => {
    await deleteTestUser(ownerEmail);
    await deleteTestUser(otherEmail);
  });

  // A real 1x1 PNG so multer's mimetype filter and sendFile both see a genuine image.
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const upload = (token: string) =>
    request(app).post('/api/v1/progress-photos').set('Authorization', `Bearer ${token}`).attach('photo', PNG, { filename: 'me.png', contentType: 'image/png' }).field('notes', 'Week 1');
  // supertest wants the path only; the signed URL is absolute.
  const pathOf = (url: string) => new URL(url).pathname + new URL(url).search;

  it('stores photos privately and serves them only through a signed URL', async () => {
    const created = await upload(owner);
    expect(created.status).toBe(201);
    const { id, photoUrl } = created.body.photo;
    expect(photoUrl).toMatch(/\/api\/v1\/progress-photos\/file\/[0-9a-f-]{36}\.png\?expires=\d+&sig=/);
    expect(created.body.photo.storageKey).toBeUndefined();

    const key = new URL(photoUrl).pathname.split('/').pop()!;
    // Not reachable through the public uploads folder.
    expect((await request(app).get(`/uploads/${key}`)).status).toBe(404);

    const served = await request(app).get(pathOf(photoUrl));
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');

    // Unsigned, tampered or expired links don't work.
    expect((await request(app).get(`/api/v1/progress-photos/file/${key}`)).status).toBe(403);
    expect((await request(app).get(pathOf(photoUrl).replace(/sig=[^&]+/, 'sig=forged'))).status).toBe(403);
    expect((await request(app).get(pathOf(photoUrl).replace(/expires=\d+/, 'expires=1000'))).status).toBe(403);

    const othersList = await request(app).get('/api/v1/progress-photos').set('Authorization', `Bearer ${other}`);
    expect(othersList.body.photos).toEqual([]);
    const othersDelete = await request(app).delete(`/api/v1/progress-photos/${id}`).set('Authorization', `Bearer ${other}`);
    expect(othersDelete.status).toBe(404);

    const ownDelete = await request(app).delete(`/api/v1/progress-photos/${id}`).set('Authorization', `Bearer ${owner}`);
    expect(ownDelete.status).toBe(204);
    expect(await prisma.progressPhoto.count({ where: { id } })).toBe(0);
    // The file goes with the row, so an old signed link stops working.
    expect((await request(app).get(pathOf(photoUrl))).status).toBe(404);
  });

  it('rejects non-image uploads and a missing file', async () => {
    const text = await request(app)
      .post('/api/v1/progress-photos')
      .set('Authorization', `Bearer ${owner}`)
      .attach('photo', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(text.status).toBe(400);

    const none = await request(app).post('/api/v1/progress-photos').set('Authorization', `Bearer ${owner}`).field('notes', 'no file');
    expect(none.status).toBe(400);
  });

  it('rejects unrealistic weights', async () => {
    const res = await request(app).post('/api/v1/users/me/weight-logs').set('Authorization', `Bearer ${owner}`).send({ weightKg: 900 });
    expect(res.status).toBe(422);
  });
});
