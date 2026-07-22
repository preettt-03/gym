import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '@/config/env';

export const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export const razorpay = isRazorpayConfigured
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! })
  : null;

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

export const isRazorpayWebhookConfigured = Boolean(env.RAZORPAY_WEBHOOK_SECRET);

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET!).update(rawBody).digest('hex');
  return expected === signature;
}
