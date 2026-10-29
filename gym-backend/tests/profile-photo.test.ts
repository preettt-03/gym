import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { UPLOAD_DIR } from '@/lib/upload';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Profile photo', () => {
  const email = uniqueTestEmail('avatar');
  let token: string;
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const put = () =>
    request(app).put('/api/v1/users/me/photo').set('Authorization', `Bearer ${token}`).attach('photo', PNG, { filename: 'me.png', contentType: 'image/png' });
  const fileOf = (url: string) => path.join(UPLOAD_DIR, path.basename(url));

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email, role: Role.USER, isEmailVerified: true } });
    token = signAccessToken({ sub: user.id, role: user.role });
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.photoUrl) fs.rmSync(fileOf(user.photoUrl), { force: true });
    await deleteTestUser(email);
  });

  it('uploads, replaces (deleting the old file) and removes a photo', async () => {
    const first = await put();
    expect(first.status).toBe(200);
    const firstUrl: string = first.body.user.photoUrl;
    expect(firstUrl).toMatch(/\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(fs.existsSync(fileOf(firstUrl))).toBe(true);

    const second = await put();
    const secondUrl: string = second.body.user.photoUrl;
    expect(secondUrl).not.toBe(firstUrl);
    expect(fs.existsSync(fileOf(firstUrl))).toBe(false);

    const removed = await request(app).delete('/api/v1/users/me/photo').set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
    expect(removed.body.user.photoUrl).toBeNull();
    expect(fs.existsSync(fileOf(secondUrl))).toBe(false);
  });

  it('rejects non-images and ignores photoUrl in a profile update', async () => {
    const text = await request(app)
      .put('/api/v1/users/me/photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(text.status).toBe(400);

    const patch = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ photoUrl: 'https://evil.example.com/pixel.gif' });
    expect(patch.body.user.photoUrl).toBeNull();
  });
});

describe('Profile update mass assignment', () => {
  const email = uniqueTestEmail('mass-assign');

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it('ignores fields the schema does not declare, like role and coins', async () => {
    const user = await prisma.user.create({ data: { email, role: Role.USER, isEmailVerified: true } });
    const res = await request(app)
      .patch('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${signAccessToken({ sub: user.id, role: user.role })}`)
      .send({ name: 'Still a member', role: 'ADMIN', coins: 999999, accountStatus: 'ACTIVE' });
    expect(res.status).toBe(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.name).toBe('Still a member');
    expect(after.role).toBe(Role.USER);
    expect(after.coins).toBe(0);
  });
});
