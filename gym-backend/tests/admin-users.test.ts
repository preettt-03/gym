import request from 'supertest';
import { AccountStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Admin user management', () => {
  const emails = {
    admin: uniqueTestEmail('users-admin'),
    trainer: uniqueTestEmail('users-trainer'),
    member: uniqueTestEmail('users-member'),
    other: uniqueTestEmail('users-other'),
  };
  const ids: Record<keyof typeof emails, string> = { admin: '', trainer: '', member: '', other: '' };
  let token: string;
  const as = () => ({ Authorization: `Bearer ${token}` });
  const patch = (id: string, body: Record<string, unknown>) =>
    request(app).patch(`/api/v1/admin/users/${id}`).set(as()).send(body);

  beforeAll(async () => {
    const roles = { admin: Role.ADMIN, trainer: Role.TRAINER, member: Role.USER, other: Role.USER };
    for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
      const u = await prisma.user.create({
        data: { email: emails[key], name: `Jest ${key}`, role: roles[key], isEmailVerified: true },
      });
      ids[key] = u.id;
    }
    token = signAccessToken({ sub: ids.admin, role: Role.ADMIN });
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: Object.values(ids) } }, data: { trainerId: null } });
    for (const email of Object.values(emails)) await deleteTestUser(email);
  });

  it('only assigns active trainers, and only to members', async () => {
    expect((await patch(ids.member, { trainerId: ids.other })).status).toBe(422);
    expect((await patch(ids.member, { trainerId: ids.member })).status).toBe(422);
    expect((await patch(ids.trainer, { trainerId: ids.trainer })).status).toBe(422);

    const ok = await patch(ids.member, { trainerId: ids.trainer });
    expect(ok.status).toBe(200);
    expect(ok.body.user.trainer.id).toBe(ids.trainer);
  });

  it('refuses to demote or delete a trainer who still has trainees', async () => {
    const demote = await patch(ids.trainer, { role: 'USER' });
    expect(demote.status).toBe(409);
    expect(demote.body.error.message).toMatch(/coaches 1 member/);

    const remove = await request(app).delete(`/api/v1/admin/users/${ids.trainer}`).set(as());
    expect(remove.status).toBe(409);
  });

  it('rejects assigning a suspended trainer', async () => {
    await prisma.user.update({ where: { id: ids.trainer }, data: { accountStatus: AccountStatus.SUSPENDED } });
    expect((await patch(ids.other, { trainerId: ids.trainer })).status).toBe(422);
    await prisma.user.update({ where: { id: ids.trainer }, data: { accountStatus: AccountStatus.ACTIVE } });
  });

  it('signs a user out everywhere when their role changes', async () => {
    await prisma.refreshToken.create({
      data: { tokenHash: `jest-role-${Date.now()}`, userId: ids.other, expiresAt: new Date(Date.now() + 60_000) },
    });
    expect((await patch(ids.other, { role: 'TRAINER' })).status).toBe(200);
    expect(await prisma.refreshToken.count({ where: { userId: ids.other, revokedAt: null } })).toBe(0);
  });

  it('returns a detail view without health notes or password data', async () => {
    const res = await request(app).get(`/api/v1/admin/users/${ids.member}`).set(as());
    expect(res.status).toBe(200);
    expect(res.body.user.trainer.id).toBe(ids.trainer);
    expect(res.body.user.activity).toEqual({ workoutsCompleted30d: 0, visits30d: 0, mealsLogged7d: 0 });
    expect(res.body.user.signInMethod).toBe('PASSWORD');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('medicalConditions');
    expect(res.body.user).not.toHaveProperty('googleId');

    const trainer = await request(app).get(`/api/v1/admin/users/${ids.trainer}`).set(as());
    expect(trainer.body.user.traineeCount).toBe(1);
  });

  it('lists users with role and status facets', async () => {
    const res = await request(app).get('/api/v1/admin/users').query({ search: 'jest-test-users-' }).set(as());
    expect(res.status).toBe(200);
    expect(res.body.facets.role.TRAINER).toBeGreaterThanOrEqual(1);
    expect(res.body.facets.accountStatus.ACTIVE).toBeGreaterThanOrEqual(4);

    const trainersOnly = await request(app).get('/api/v1/admin/users').query({ search: 'jest-test-users-', role: 'TRAINER' }).set(as());
    expect(trainersOnly.body.items.every((u: { role: string }) => u.role === 'TRAINER')).toBe(true);
    // Facets ignore the role filter so every chip keeps its count.
    expect(trainersOnly.body.facets.role.USER).toBeGreaterThanOrEqual(1);
  });
});
