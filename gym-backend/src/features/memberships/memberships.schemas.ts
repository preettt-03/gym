import { z } from 'zod';

export const checkoutSchema = z.object({
  body: z.object({
    planId: z.string().uuid(),
    gateway: z.enum(['RAZORPAY', 'STRIPE', 'UPI', 'CARD', 'WALLET']),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    paymentId: z.string().uuid(),
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1),
  }),
});
