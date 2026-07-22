import { z } from 'zod';

export const checkoutSchema = z.object({
  body: z.object({
    planId: z.string().uuid(),
    gateway: z.enum(['RAZORPAY', 'STRIPE', 'UPI', 'CARD', 'WALLET']),
  }),
});
