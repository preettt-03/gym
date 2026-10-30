import { z } from 'zod';

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    role: z.enum(['ADMIN', 'TRAINER', 'USER']).optional(),
    accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    role: z.enum(['ADMIN', 'TRAINER', 'USER']).optional(),
    accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
    trainerId: z.string().uuid().nullable().optional(),
    // Not stored on the user — kept so the audit log records why.
    reason: z.string().trim().max(200).optional(),
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
