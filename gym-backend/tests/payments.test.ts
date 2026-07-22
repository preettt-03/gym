import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

describe('Payments invoice', () => {
  const email = uniqueTestEmail('payments');
  const password = 'SuperSecret123';
  let accessToken: string;
  let paymentId: string;

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const code = await getLatestOtp(user.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email, code });
    accessToken = verifyRes.body.accessToken;

    const plan = await prisma.membershipPlan.findFirst();
    if (!plan) throw new Error('No membership plans seeded — cannot test invoices.');

    const membership = await prisma.membership.create({
      data: { userId: user.id, planId: plan.id, endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        planId: plan.id,
        membershipId: membership.id,
        amount: plan.price,
        currency: 'INR',
        status: 'COMPLETED',
        gateway: 'UPI',
        invoiceNumber: `TEST-${Date.now()}`,
      },
    });
    paymentId = payment.id;
  });

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it('returns invoice data as JSON', async () => {
    const res = await request(app)
      .get(`/api/v1/payments/me/${paymentId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('returns a real PDF for the same invoice', async () => {
    const res = await request(app)
      .get(`/api/v1/payments/me/${paymentId}/invoice.pdf`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('404s for a payment that belongs to someone else', async () => {
    const otherEmail = uniqueTestEmail('payments-other');
    await request(app).post('/api/v1/auth/register').send({ email: otherEmail, password });
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { email: otherEmail } });
    const code = await getLatestOtp(otherUser.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email: otherEmail, code });

    const res = await request(app)
      .get(`/api/v1/payments/me/${paymentId}/invoice`)
      .set('Authorization', `Bearer ${verifyRes.body.accessToken}`);

    expect(res.status).toBe(404);
    await deleteTestUser(otherEmail);
  });
});
