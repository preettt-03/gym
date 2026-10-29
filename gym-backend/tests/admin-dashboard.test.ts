import request from 'supertest';
import { PaymentGateway, PaymentStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { app, deleteTestUser, uniqueTestEmail } from './helpers';

describe('Admin dashboard analytics', () => {
  const adminEmail = uniqueTestEmail('dash-admin');
  const memberEmail = uniqueTestEmail('dash-member');
  let adminToken: string;
  let memberToken: string;
  let planId: string;
  let memberId: string;

  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: { email: adminEmail, role: Role.ADMIN, isEmailVerified: true },
    });
    const member = await prisma.user.create({
      data: { email: memberEmail, name: 'Dash Member', role: Role.USER, isEmailVerified: true },
    });
    memberId = member.id;
    adminToken = signAccessToken({ sub: admin.id, role: admin.role });
    memberToken = signAccessToken({ sub: member.id, role: member.role });

    const plan = await prisma.membershipPlan.create({
      data: { name: `Jest Dashboard Plan ${Date.now()}`, durationDays: 30, price: 1234 },
    });
    planId = plan.id;

    const membership = await prisma.membership.create({
      data: {
        userId: member.id,
        planId,
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.payment.create({
      data: {
        userId: member.id,
        planId,
        membershipId: membership.id,
        amount: 1234,
        gateway: PaymentGateway.RAZORPAY,
        status: PaymentStatus.COMPLETED,
      },
    });
    await prisma.attendance.create({ data: { userId: member.id, membershipId: membership.id } });
  });

  afterAll(async () => {
    await deleteTestUser(memberEmail);
    await deleteTestUser(adminEmail);
    await prisma.membershipPlan.delete({ where: { id: planId } });
  });

  it('returns zero-filled daily trends that include today', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard/analytics?days=7')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.range.days).toBe(7);
    expect(res.body.trends.revenue).toHaveLength(7);
    expect(res.body.trends.attendance).toHaveLength(7);

    const today = res.body.trends.revenue.at(-1);
    expect(today.date).toBe(res.body.range.to);
    expect(today.value).toBeGreaterThanOrEqual(1234);
    expect(res.body.trends.attendance.at(-1).value).toBeGreaterThanOrEqual(1);
    expect(res.body.totals.revenue.current).toBeGreaterThanOrEqual(1234);
  });

  it('counts the membership as expiring soon and lists it', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard/analytics?days=30')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.membershipStatus.expiringSoon).toBeGreaterThanOrEqual(1);
    expect(res.body.expiringSoon.some((m: { user: { id: string } }) => m.user.id === memberId)).toBe(true);
    expect(res.body.activeByPlan.find((p: { planId: string }) => p.planId === planId)?.count).toBe(1);
    expect(res.body.recentPayments[0].user).not.toHaveProperty('passwordHash');
  });

  it('rejects an unsupported range', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard/analytics?days=12')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(422);
  });

  it('is admin-only', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard/analytics')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });
});
