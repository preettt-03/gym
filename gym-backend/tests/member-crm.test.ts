import request from 'supertest';
import { MembershipStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

const DAY = 24 * 60 * 60 * 1000;

describe('Admin member CRM', () => {
  const adminEmail = uniqueTestEmail('crm-admin');
  const memberEmail = uniqueTestEmail('crm-member');
  const otherEmail = uniqueTestEmail('crm-other');
  const trainerEmail = uniqueTestEmail('crm-trainer');
  let admin: string;
  let adminId: string;
  let memberToken: string;
  let memberId: string;
  let otherId: string;
  let trainerId: string;
  let planId: string;
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  const url = (path = '') => `/api/v1/admin/users/${memberId}${path}`;
  const membership = () => prisma.membership.findFirstOrThrow({ where: { userId: memberId }, orderBy: { endDate: 'desc' } });

  beforeAll(async () => {
    const a = await prisma.user.create({ data: { email: adminEmail, role: Role.ADMIN, isEmailVerified: true, name: 'Desk Admin' } });
    const t = await prisma.user.create({ data: { email: trainerEmail, role: Role.TRAINER, isEmailVerified: true } });
    const m = await prisma.user.create({ data: { email: memberEmail, role: Role.USER, isEmailVerified: true, trainerId: t.id } });
    const o = await prisma.user.create({ data: { email: otherEmail, role: Role.USER, isEmailVerified: true } });
    const plan = await prisma.membershipPlan.create({ data: { name: `Jest Monthly ${Date.now()}`, durationDays: 30, price: 1500 } });
    admin = signAccessToken({ sub: a.id, role: a.role });
    memberToken = signAccessToken({ sub: m.id, role: m.role });
    [adminId, memberId, otherId, trainerId, planId] = [a.id, m.id, o.id, t.id, plan.id];
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { adminId } });
    await prisma.payment.deleteMany({ where: { userId: { in: [memberId, otherId] } } });
    await prisma.attendance.deleteMany({ where: { userId: { in: [memberId, otherId] } } });
    await prisma.membership.deleteMany({ where: { userId: { in: [memberId, otherId] } } });
    await prisma.membershipPlan.delete({ where: { id: planId } });
    for (const e of [memberEmail, otherEmail, trainerEmail, adminEmail]) await deleteTestUser(e);
  });

  it('records a desk cash payment that starts the membership, with a branded PDF invoice', async () => {
    const res = await request(app).post(url('/payments')).set(as(admin)).send({ planId, amount: 1200, method: 'CASH', reference: '', note: 'Paid at desk' });
    expect(res.status).toBe(201);
    expect(res.body.payment).toMatchObject({ amount: 1200, gateway: 'CASH', status: 'COMPLETED', recordedById: adminId, note: 'Paid at desk' });
    expect((await membership()).status).toBe(MembershipStatus.ACTIVE);

    const list = await request(app).get(url('/payments')).set(as(admin));
    expect(list.body.items[0]).toMatchObject({ desk: true, gateway: 'CASH' });

    const pdf = await request(app).get(url(`/payments/${res.body.payment.id}/invoice`)).set(as(admin)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

    // Another member's payment can't be fetched through this member's URL.
    const bad = await request(app).get(`/api/v1/admin/users/${otherId}/payments/${res.body.payment.id}/invoice`).set(as(admin));
    expect(bad.status).toBe(404);
  });

  it('extends, freezes (blocking check-in), resumes with the paused days added back', async () => {
    const before = (await membership()).endDate.getTime();
    expect((await request(app).post(url('/membership/extend')).set(as(admin)).send({ days: 7 })).status).toBe(200);
    expect((await membership()).endDate.getTime()).toBe(before + 7 * DAY);

    const freeze = await request(app).post(url('/membership/freeze')).set(as(admin)).send({ resumeAt: new Date(Date.now() + 10 * DAY).toISOString(), reason: 'Travelling' });
    expect(freeze.status).toBe(200);
    expect((await membership()).status).toBe(MembershipStatus.FROZEN);
    expect((await request(app).post(url('/check-in')).set(as(admin))).status).toBe(403);

    // Pretend it was frozen 3 days ago, then resume now.
    const m = await membership();
    await prisma.membership.update({ where: { id: m.id }, data: { frozenAt: new Date(Date.now() - 3 * DAY) } });
    expect((await request(app).post(url('/membership/unfreeze')).set(as(admin))).status).toBe(200);
    const resumed = await membership();
    expect(resumed.status).toBe(MembershipStatus.ACTIVE);
    expect(Math.round((resumed.endDate.getTime() - m.endDate.getTime()) / DAY)).toBe(3);
  });

  it('resumes a freeze automatically once its resume date passes', async () => {
    const m = await membership();
    await prisma.membership.update({ where: { id: m.id }, data: { status: MembershipStatus.FROZEN, frozenAt: new Date(Date.now() - 2 * DAY), resumeAt: new Date(Date.now() - DAY) } });
    const detail = await request(app).get(url()).set(as(admin));
    expect(detail.body.user.membership.status).toBe('ACTIVE');
    expect(Math.round(((await membership()).endDate.getTime() - m.endDate.getTime()) / DAY)).toBe(1);
  });

  it('checks the member in at the desk and shows it on the timeline', async () => {
    const res = await request(app).post(url('/check-in')).set(as(admin));
    expect(res.status).toBe(201);
    expect(res.body.attendance.method).toBe('ADMIN_APPROVED');
    await prisma.attendance.update({ where: { id: res.body.attendance.id }, data: { checkOutAt: new Date(), durationMinutes: 45 } });

    const timeline = await request(app).get(url('/timeline')).set(as(admin));
    const titles = timeline.body.items.map((i: { title: string }) => i.title);
    expect(titles).toEqual(expect.arrayContaining(['Checked in', 'Membership extended by 7 days', 'Membership frozen — “Travelling”', 'Membership resumed']));
    expect(titles.some((t: string) => t.startsWith('Paid ₹1,200'))).toBe(true);

    const detail = await request(app).get(url()).set(as(admin));
    expect(Object.values(detail.body.user.attendanceHeatmap.counts)).toContain(1);
    expect(detail.body.user.attendanceHeatmap.streak).toBe(1);
  });

  it('flags a membership that is about to expire, and nudges once a day', async () => {
    const m = await membership();
    await prisma.membership.update({ where: { id: m.id }, data: { endDate: new Date(Date.now() + 3 * DAY) } });
    const detail = await request(app).get(url()).set(as(admin));
    expect(detail.body.user.alerts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'EXPIRING', days: 3 })]));

    expect((await request(app).post(url('/nudge')).set(as(admin)).send({ kind: 'EXPIRING' })).status).toBe(201);
    expect((await request(app).post(url('/nudge')).set(as(admin)).send({ kind: 'EXPIRING' })).status).toBe(429);
    expect(await prisma.notification.count({ where: { userId: memberId, type: 'MEMBERSHIP_EXPIRY' } })).toBe(1);
  });

  it('needs a reason to cancel', async () => {
    expect((await request(app).post(url('/membership/cancel')).set(as(admin)).send({})).status).toBe(422);
    expect((await request(app).post(url('/membership/cancel')).set(as(admin)).send({ reason: 'Moved city' })).status).toBe(200);
    expect((await membership()).status).toBe(MembershipStatus.CANCELLED);
    const timeline = await request(app).get(url('/timeline')).set(as(admin));
    expect(timeline.body.items.map((i: { title: string }) => i.title)).toContain('Membership cancelled — “Moved city”');
  });

  it('edits contact details, tags and locker/RFID with clear conflicts', async () => {
    const bad = await request(app).patch(url('/profile')).set(as(admin)).send({ phone: 'call me' });
    expect(bad.status).toBe(422);
    const ok = await request(app)
      .patch(url('/profile'))
      .set(as(admin))
      .send({ name: 'Ravi Kumar', phone: '+91 98765-43210', emergencyContactName: 'Sita', emergencyContactPhone: '9876500000', emergencyContactRelation: 'Mother', role: 'ADMIN' });
    expect(ok.status).toBe(200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: memberId } });
    expect(saved).toMatchObject({ name: 'Ravi Kumar', phone: '+919876543210', emergencyContactRelation: 'Mother', role: 'USER' });

    const tags = await request(app).put(url('/tags')).set(as(admin)).send({ tags: ['VIP', ' vip ', 'Knee issue'] });
    expect(tags.body.tags).toEqual(['VIP', 'Knee issue']);

    expect((await request(app).put(url('/facility')).set(as(admin)).send({ lockerNumber: 'A-12', rfidTagId: 'RFID0001' })).status).toBe(200);
    const clash = await request(app).put(`/api/v1/admin/users/${otherId}/facility`).set(as(admin)).send({ lockerNumber: 'A-12' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.message).toMatch(/Locker A-12 is already assigned to Ravi Kumar/);
    expect((await request(app).put(url('/facility')).set(as(admin)).send({ lockerNumber: null })).status).toBe(200);
    expect((await request(app).put(`/api/v1/admin/users/${otherId}/facility`).set(as(admin)).send({ lockerNumber: 'A-12' })).status).toBe(200);
  });

  it('tracks PT sessions without going over the package and notifies the trainer', async () => {
    expect((await request(app).post(url('/pt/complete')).set(as(admin))).status).toBe(409);
    await request(app).put(url('/pt/package')).set(as(admin)).send({ total: 2 });
    expect((await request(app).post(url('/pt/complete')).set(as(admin))).status).toBe(201);
    expect((await request(app).post(url('/pt/complete')).set(as(admin))).status).toBe(201);
    expect((await request(app).post(url('/pt/complete')).set(as(admin))).status).toBe(409);
    expect((await request(app).put(url('/pt/package')).set(as(admin)).send({ total: 1 })).status).toBe(422);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: memberId } });
    expect(user).toMatchObject({ ptSessionsTotal: 2, ptSessionsUsed: 2 });
    expect(await prisma.ptSession.count({ where: { userId: memberId, trainerId } })).toBe(2);
    // Notifications are fire-and-forget; give them a moment.
    await new Promise((r) => setTimeout(r, 200));
    expect(await prisma.notification.count({ where: { userId: trainerId, title: 'PT session logged' } })).toBe(2);
  });

  it('keeps staff notes with follow-ups', async () => {
    const created = await request(app).post(url('/notes')).set(as(admin)).send({ body: 'Call about renewal', followUpDate: new Date(Date.now() + 2 * DAY).toISOString() });
    expect(created.status).toBe(201);
    expect(created.body.note.author.name).toBe('Desk Admin');
    const done = await request(app).patch(url(`/notes/${created.body.note.id}`)).set(as(admin)).send({ isDone: true });
    expect(done.body.note.isDone).toBe(true);
    expect((await request(app).get(url('/notes')).set(as(admin))).body.notes).toHaveLength(1);
    expect((await request(app).delete(`/api/v1/admin/users/${otherId}/notes/${created.body.note.id}`).set(as(admin))).status).toBe(404);
    expect((await request(app).delete(url(`/notes/${created.body.note.id}`)).set(as(admin))).status).toBe(204);
  });

  it('hides medical details until revealed and logs every reveal', async () => {
    await request(app).patch(url('/medical')).set(as(admin)).send({ medicalConditions: ['Asthma'], medicalNotes: 'Cleared for moderate cardio' });
    const detail = await request(app).get(url()).set(as(admin));
    expect(JSON.stringify(detail.body)).not.toContain('Asthma');

    await request(app).post(url('/medical/reveal')).set(as(admin));
    await new Promise((r) => setTimeout(r, 200)); // the audit row is written after the response
    const second = await request(app).post(url('/medical/reveal')).set(as(admin));
    expect(second.body.medical).toMatchObject({ medicalConditions: ['Asthma'], medicalNotes: 'Cleared for moderate cardio' });
    expect(second.body.medical.viewLog[0]).toMatchObject({ by: 'Desk Admin' });
  });

  it('signs a member out everywhere only with a reason, and never yourself', async () => {
    await prisma.refreshToken.create({ data: { tokenHash: `crm-${Date.now()}`, userId: memberId, expiresAt: new Date(Date.now() + DAY) } });
    expect((await request(app).post(url('/sessions/revoke')).set(as(admin)).send({})).status).toBe(422);
    const res = await request(app).post(url('/sessions/revoke')).set(as(admin)).send({ reason: 'Lost phone' });
    expect(res.body.revoked).toBe(1);
    expect((await request(app).post(`/api/v1/admin/users/${adminId}/sessions/revoke`).set(as(admin)).send({ reason: 'test' })).status).toBe(400);
    expect((await request(app).post(url('/resend-verification')).set(as(admin))).status).toBe(409);
  });

  it('is admin-only', async () => {
    expect((await request(app).post(url('/check-in')).set(as(memberToken))).status).toBe(403);
    expect((await request(app).get(url('/notes')).set(as(memberToken))).status).toBe(403);
  });
});
