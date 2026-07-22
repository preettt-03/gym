import crypto from 'crypto';
import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { isRazorpayConfigured, isRazorpayWebhookConfigured } from '@/features/memberships/razorpay';
import { app, deleteTestUser, getLatestOtp, uniqueTestEmail } from './helpers';

function signWebhookBody(rawBody: string) {
  return crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET!).update(rawBody).digest('hex');
}

function captureWebhookBody(orderId: string, paymentId: string) {
  return JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
  });
}

function failedWebhookBody(orderId: string, paymentId: string) {
  return JSON.stringify({
    event: 'payment.failed',
    payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
  });
}

describe('Razorpay webhook', () => {
  const email = uniqueTestEmail('webhook');
  const password = 'SuperSecret123';
  let accessToken: string;
  let planId: string;

  const configured = isRazorpayConfigured && isRazorpayWebhookConfigured;

  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({ email, password });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const code = await getLatestOtp(user.id);
    const verifyRes = await request(app).post('/api/v1/auth/verify-email').send({ email, code });
    accessToken = verifyRes.body.accessToken;

    const plan = await prisma.membershipPlan.findFirst({ where: { isActive: true, deletedAt: null } });
    if (!plan) throw new Error('No active membership plans seeded — cannot test webhooks.');
    planId = plan.id;
  });

  afterAll(async () => {
    await deleteTestUser(email);
  });

  it('rejects a request with a bad signature', async () => {
    if (!isRazorpayWebhookConfigured) {
      const res = await request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'irrelevant')
        .send('{}');
      expect(res.status).toBe(501);
      return;
    }

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'wrong-signature')
      .send('{"event":"payment.captured"}');

    expect(res.status).toBe(400);
  });

  it('completes a PENDING payment and activates the membership on payment.captured', async () => {
    if (!configured) return;

    const checkoutRes = await request(app)
      .post('/api/v1/memberships/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId, gateway: 'RAZORPAY' });
    const { paymentId, orderId } = checkoutRes.body;

    const razorpayPaymentId = `pay_webhook_${Date.now()}`;
    const rawBody = captureWebhookBody(orderId, razorpayPaymentId);
    const signature = signWebhookBody(rawBody);

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(rawBody);

    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('COMPLETED');
    expect(payment.gatewayReferenceId).toBe(razorpayPaymentId);

    const membership = await prisma.membership.findFirst({ where: { userId: payment.userId } });
    expect(membership?.status).toBe('ACTIVE');
  });

  it('is idempotent for a duplicate payment.captured delivery', async () => {
    if (!configured) return;

    const checkoutRes = await request(app)
      .post('/api/v1/memberships/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId, gateway: 'RAZORPAY' });
    const { paymentId, orderId } = checkoutRes.body;

    const razorpayPaymentId = `pay_webhook_dup_${Date.now()}`;
    const rawBody = captureWebhookBody(orderId, razorpayPaymentId);
    const signature = signWebhookBody(rawBody);

    await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(rawBody);

    // Same event delivered a second time (Razorpay's documented at-least-once
    // behavior) should not throw or double-activate.
    const secondRes = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(rawBody);

    expect(secondRes.status).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('COMPLETED');
  });

  it('marks a PENDING payment FAILED on payment.failed', async () => {
    if (!configured) return;

    const checkoutRes = await request(app)
      .post('/api/v1/memberships/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId, gateway: 'RAZORPAY' });
    const { paymentId, orderId } = checkoutRes.body;

    const razorpayPaymentId = `pay_webhook_fail_${Date.now()}`;
    const rawBody = failedWebhookBody(orderId, razorpayPaymentId);
    const signature = signWebhookBody(rawBody);

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(rawBody);

    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('FAILED');
  });
});
