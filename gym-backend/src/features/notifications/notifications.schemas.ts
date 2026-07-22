import { z } from 'zod';

export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    unreadOnly: z.string().optional(),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const broadcastSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    body: z.string().optional(),
    userIds: z.array(z.string().uuid()).optional(), // omit to broadcast to all non-admin users
  }),
});
