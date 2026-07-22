import { Router } from 'express';
import express from 'express';
import { logger } from '@/config/logger';
import { isRazorpayWebhookConfigured, verifyRazorpayWebhookSignature } from '@/features/memberships/razorpay';
import {
  completeRazorpayPaymentFromWebhook,
  markRazorpayPaymentFailedFromWebhook,
} from '@/features/memberships/memberships.service';

export const webhooksRouter = Router();

// Needs the raw request bytes (not the parsed JSON body) to verify Razorpay's
// HMAC signature, so this route carries its own body parser instead of relying
// on the app-wide express.json() — it must be mounted before that global parser.
webhooksRouter.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!isRazorpayWebhookConfigured) {
    res.status(501).json({ error: { message: 'Razorpay webhooks are not configured' } });
    return;
  }

  const signature = req.header('x-razorpay-signature');
  const rawBody = req.body as Buffer;

  if (!signature || !Buffer.isBuffer(rawBody) || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    res.status(400).json({ error: { message: 'Invalid webhook signature' } });
    return;
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } }; order?: { entity?: { id?: string } } };
  };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ error: { message: 'Invalid JSON payload' } });
    return;
  }

  const paymentEntity = event.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id ?? event.payload?.order?.entity?.id;
  const paymentId = paymentEntity?.id;

  try {
    if (event.event === 'payment.captured' && orderId && paymentId) {
      await completeRazorpayPaymentFromWebhook(orderId, paymentId);
    } else if (event.event === 'payment.failed' && orderId) {
      await markRazorpayPaymentFailedFromWebhook(orderId);
    }
  } catch (err) {
    // Log and still 200 — Razorpay retries on non-2xx, and a processing bug on
    // our side shouldn't cause it to hammer this endpoint indefinitely.
    logger.error('Razorpay webhook processing failed', { error: err instanceof Error ? err.message : err });
  }

  res.status(200).json({ received: true });
});
