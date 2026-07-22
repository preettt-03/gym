import crypto from 'crypto';
import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { isRazorpayConfigured } from '@/features/memberships/razorpay';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

function signRazorpayPayment(orderId: string, paymentId: string) {
  return crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

describe('Membership checkout with Razorpay', () => {
  const email = uniqueTestEmail('checkout');
  const password = 'SuperSecret123';
  let accessToken: string;
  let planId: string;

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const code = await getLatestOtp(user.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email, code });
    accessToken = verifyRes.body.accessToken;

    const plan = await prisma.membershipPlan.findFirst({ where: { isActive: true, deletedAt: null } });
    if (!plan) throw new Error('No active membership plans seeded — cannot test checkout.');
    planId = plan.id;
  });

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it('creates a real Razorpay order instead of the demo flow when configured', async () => {
    if (!isRazorpayConfigured) {
      // No test-mode keys in this environment — checkout still works, just via
      // the demo fallback, which payments.test.ts already covers.
      return;
    }

    const res = await request(app)
      .post('/api/v1/memberships/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId, gateway: 'RAZORPAY' });

    expect(res.status).toBe(201);
    expect(res.body.requiresPayment).toBe(true);
    expect(res.body.demo).toBe(false);
    expect(res.body.orderId).toMatch(/^order_/);
    expect(res.body.keyId).toBe(env.RAZORPAY_KEY_ID);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.body.paymentId } });
    expect(payment.status).toBe('PENDING');
    expect(payment.gatewayReferenceId).toBe(res.body.orderId);
  });

  it('activates the membership once a validly-signed payment is verified', async () => {
    if (!isRazorpayConfigured) return;

    const checkoutRes = await request(app)
      .post('/api/v1/memberships/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId, gateway: 'RAZORPAY' });

    const { paymentId, orderId } = checkoutRes.body;
    const fakeRazorpayPaymentId = `pay_test_${Date.now()}`;
    const signature = signRazorpayPayment(orderId, fakeRazorpayPaymentId);

    const verifyRes = await request(app)
      .post('/api/v1/memberships/verify-payment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        paymentId,
        razorpayOrderId: orderId,
        razorpayPaymentId: fakeRazorpayPaymentId,
        razorpaySignature: signature,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.membership.status).toBe('ACTIVE');
    expect(verifyRes.body.payment.status).toBe('COMPLETED');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('COMPLETED');
    expect(payment.gatewayReferenceId).toBe(fakeRazorpayPaymentId);
  });

  it('rejects and fails a payment with an invalid signature', async () => {
    if (!isRazorpayConfigured) return;

    const checkoutRes = await request(app)
      .post('/api/v1/memberships/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId, gateway: 'RAZORPAY' });

    const { paymentId, orderId } = checkoutRes.body;

    const verifyRes = await request(app)
      .post('/api/v1/memberships/verify-payment')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        paymentId,
        razorpayOrderId: orderId,
        razorpayPaymentId: 'pay_forged',
        razorpaySignature: 'not-a-real-signature',
      });

    expect(verifyRes.status).toBe(400);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('FAILED');
  });

  it('404s for an unknown membership plan', async () => {
    if (!isRazorpayConfigured) return;

    const res = await request(app)
      .post('/api/v1/memberships/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId: '00000000-0000-0000-0000-000000000000', gateway: 'RAZORPAY' });

    expect(res.status).toBe(404);
  });
});
