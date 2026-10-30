import { z } from 'zod';

const messageTypeEnum = z.enum(['TEXT', 'IMAGE', 'VOICE']);

export const sendMessageSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({
    type: messageTypeEnum.default('TEXT'),
    content: z.string().optional(),
    mediaUrl: z.string().url().optional(),
  }),
});

export const roomIdParamSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
});

export const messageIdParamSchema = z.object({
  params: z.object({ messageId: z.string().uuid() }),
});

export const listMessagesSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    // Cursor: only messages older than this one (for "load earlier").
    before: z.string().uuid().optional(),
  }),
});

export const directRoomSchema = z.object({
  body: z.object({ userId: z.string().uuid() }),
});

export const reportMessageSchema = z.object({
  params: z.object({ messageId: z.string().uuid() }),
  body: z.object({ reason: z.string().optional() }),
});

export const blockUserSchema = z.object({
  params: z.object({ userId: z.string().uuid() }),
});

export const createChannelSchema = z.object({
  body: z.object({ name: z.string().min(1) }),
});

export const channelMembersSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({ userIds: z.array(z.string().uuid()).min(1) }),
});

export const removeMemberSchema = z.object({
  params: z.object({ roomId: z.string().uuid(), userId: z.string().uuid() }),
});
