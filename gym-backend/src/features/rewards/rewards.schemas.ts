import { z } from 'zod';

const itemBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).nullable().optional(),
  imageUrl: z.string().trim().url().max(500).nullable().optional(),
  costCoins: z.number().int().min(1).max(1_000_000),
  stock: z.number().int().min(0).max(100_000).nullable().optional(),
  maxPerMember: z.number().int().min(1).max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

const id = z.object({ id: z.string().uuid() });

export const createItemSchema = z.object({ body: itemBody });
export const updateItemSchema = z.object({ params: id, body: itemBody.partial() });
export const idParamSchema = z.object({ params: id });
export const noteSchema = z.object({ params: id, body: z.object({ note: z.string().trim().max(200).optional() }) });

export const redemptionsQuery = z.object({
  status: z.enum(['PENDING', 'FULFILLED', 'CANCELLED']).optional(),
  code: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const redemptionsQuerySchema = z.object({ query: redemptionsQuery });
