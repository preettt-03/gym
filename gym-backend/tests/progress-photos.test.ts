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

  it('only lets the owner see and delete a photo', async () => {
    const created = await request(app)
      .post('/api/v1/progress-photos')
      .set('Authorization', `Bearer ${owner}`)
      .send({ photoUrl: 'http://localhost:8004/uploads/jest-not-a-real-file.jpg', notes: 'Week 1' });
    expect(created.status).toBe(201);
    const id = created.body.photo.id;

    const othersList = await request(app).get('/api/v1/progress-photos').set('Authorization', `Bearer ${other}`);
    expect(othersList.body.photos).toEqual([]);

    const othersDelete = await request(app).delete(`/api/v1/progress-photos/${id}`).set('Authorization', `Bearer ${other}`);
    expect(othersDelete.status).toBe(404);

    const ownDelete = await request(app).delete(`/api/v1/progress-photos/${id}`).set('Authorization', `Bearer ${owner}`);
    expect(ownDelete.status).toBe(204);
    expect(await prisma.progressPhoto.count({ where: { id } })).toBe(0);
  });

  it('rejects unrealistic weights', async () => {
    const res = await request(app).post('/api/v1/users/me/weight-logs').set('Authorization', `Bearer ${owner}`).send({ weightKg: 900 });
    expect(res.status).toBe(422);
  });
});
