import request from 'supertest';
import { FitnessTool, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Fitness tools', () => {
  const adminEmail = uniqueTestEmail('tools-admin');
  const memberEmail = uniqueTestEmail('tools-member');
  let admin: string;
  let member: string;
  let original: FitnessTool[];
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    original = await prisma.fitnessTool.findMany({ orderBy: { position: 'asc' } });
    const a = await prisma.user.create({ data: { email: adminEmail, role: Role.ADMIN, isEmailVerified: true } });
    const m = await prisma.user.create({ data: { email: memberEmail, role: Role.USER, isEmailVerified: true } });
    admin = signAccessToken({ sub: a.id, role: a.role });
    member = signAccessToken({ sub: m.id, role: m.role });
  });

  // Shared dev database: put every tool back exactly as it was.
  afterAll(async () => {
    await prisma.$transaction(
      original.map((t) =>
        prisma.fitnessTool.update({ where: { id: t.id }, data: { isEnabled: t.isEnabled, position: t.position, title: t.title, description: t.description } })
      )
    );
    await deleteTestUser(adminEmail);
    await deleteTestUser(memberEmail);
  });

  it('ships all ten calculators', () => {
    expect(original.map((t) => t.slug).sort()).toEqual(
      ['1rm', 'bmi', 'bmr', 'body-fat', 'heart-rate', 'macros', 'plate-loader', 'tdee', 'timer', 'water'].sort()
    );
  });

  it('hides a disabled tool from members, list and detail alike', async () => {
    const bmi = original.find((t) => t.slug === 'bmi')!;
    const off = await request(app).patch(`/api/v1/admin/tools/${bmi.id}`).set(as(admin)).send({ isEnabled: false });
    expect(off.status).toBe(200);

    const list = await request(app).get('/api/v1/tools');
    expect(list.status).toBe(200);
    expect(list.body.tools.map((t: { slug: string }) => t.slug)).not.toContain('bmi');
    expect(list.body.tools[0]).not.toHaveProperty('isEnabled');
    expect((await request(app).get('/api/v1/tools/bmi')).status).toBe(404);

    await request(app).patch(`/api/v1/admin/tools/${bmi.id}`).set(as(admin)).send({ isEnabled: true });
    expect((await request(app).get('/api/v1/tools/bmi')).status).toBe(200);
  });

  it('reorders only with the complete list of tools', async () => {
    const reversed = [...original].reverse().map((t) => t.id);
    const res = await request(app).put('/api/v1/admin/tools/order').set(as(admin)).send({ ids: reversed });
    expect(res.status).toBe(200);
    expect(res.body.tools.map((t: { id: string }) => t.id)).toEqual(reversed);

    const partial = await request(app).put('/api/v1/admin/tools/order').set(as(admin)).send({ ids: reversed.slice(1) });
    expect(partial.status).toBe(422);
    const duplicated = await request(app).put('/api/v1/admin/tools/order').set(as(admin)).send({ ids: [...reversed.slice(1), reversed[1]] });
    expect(duplicated.status).toBe(422);
  });

  it('lets admins edit the card copy, with limits', async () => {
    const id = original[0].id;
    const ok = await request(app).patch(`/api/v1/admin/tools/${id}`).set(as(admin)).send({ title: '  1RM Calculator ', description: 'Find your max.' });
    expect(ok.body.tool).toMatchObject({ title: '1RM Calculator', description: 'Find your max.' });
    expect((await request(app).patch(`/api/v1/admin/tools/${id}`).set(as(admin)).send({ title: '' })).status).toBe(422);
    expect((await request(app).patch(`/api/v1/admin/tools/${id}`).set(as(admin)).send({})).status).toBe(422);
    // Slug and category belong to the code, not the admin.
    await request(app).patch(`/api/v1/admin/tools/${id}`).set(as(admin)).send({ title: 'X', slug: 'hacked', category: 'CARDIO' });
    expect(await prisma.fitnessTool.findUnique({ where: { id } })).toMatchObject({ slug: original[0].slug, category: original[0].category });
  });

  it('keeps the admin endpoints admin-only', async () => {
    expect((await request(app).get('/api/v1/admin/tools').set(as(member))).status).toBe(403);
    expect((await request(app).patch(`/api/v1/admin/tools/${original[0].id}`).set(as(member)).send({ isEnabled: false })).status).toBe(403);
  });
});
