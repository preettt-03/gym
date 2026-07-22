import { z } from 'zod';

const planBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationDays: z.number().int().positive(),
  price: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).optional(),
  benefits: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const createPlanSchema = z.object({ body: planBody });

export const updatePlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: planBody.partial(),
});

export const planIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type MembershipPlanInput = z.infer<typeof planBody>;
export type MembershipPlanUpdateInput = Partial<MembershipPlanInput>;
