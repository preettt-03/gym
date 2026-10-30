import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth, requireRole } from '@/middlewares/auth';
import * as controller from '@/features/chat/chat.controller';
import * as schemas from '@/features/chat/chat.schemas';

// Public, read-only: /api/v1/chat/public — the "Everyone" room for signed-out visitors.
export const publicChatRouter = Router();

publicChatRouter.get('/everyone/messages', asyncHandler(controller.listPublicGlobalMessages));

// User-facing: /api/v1/chat
export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.get('/rooms', asyncHandler(controller.listRooms));
chatRouter.get('/unread', asyncHandler(controller.unreadCounts));
chatRouter.post('/rooms/direct', validate(schemas.directRoomSchema), asyncHandler(controller.getOrCreateDirect));
chatRouter.get(
  '/rooms/:roomId/messages',
  validate(schemas.listMessagesSchema),
  asyncHandler(controller.listMessages)
);
chatRouter.post(
  '/rooms/:roomId/messages',
  validate(schemas.sendMessageSchema),
  asyncHandler(controller.sendMessage)
);
chatRouter.post(
  '/rooms/:roomId/read',
  validate(schemas.roomIdParamSchema),
  asyncHandler(controller.markRead)
);
chatRouter.delete(
  '/messages/:messageId',
  validate(schemas.messageIdParamSchema),
  asyncHandler(controller.deleteMessage)
);
chatRouter.post(
  '/messages/:messageId/report',
  validate(schemas.reportMessageSchema),
  asyncHandler(controller.reportMessage)
);
chatRouter.post('/users/:userId/block', validate(schemas.blockUserSchema), asyncHandler(controller.blockUser));
chatRouter.delete('/users/:userId/block', validate(schemas.blockUserSchema), asyncHandler(controller.unblockUser));

// Admin: /api/v1/admin/chat
export const adminChatRouter = Router();
adminChatRouter.use(requireAuth, requireRole(Role.ADMIN));

adminChatRouter.post('/channels', validate(schemas.createChannelSchema), asyncHandler(controller.createChannel));
adminChatRouter.get('/channels', asyncHandler(controller.listAllChannels));
adminChatRouter.post(
  '/channels/:roomId/members',
  validate(schemas.channelMembersSchema),
  asyncHandler(controller.addChannelMembers)
);
adminChatRouter.delete(
  '/channels/:roomId/members/:userId',
  validate(schemas.removeMemberSchema),
  asyncHandler(controller.removeChannelMember)
);
adminChatRouter.post(
  '/messages/:messageId/pin',
  validate(schemas.messageIdParamSchema),
  asyncHandler(controller.pinMessage)
);
adminChatRouter.delete(
  '/messages/:messageId/pin',
  validate(schemas.messageIdParamSchema),
  asyncHandler(controller.unpinMessage)
);
adminChatRouter.delete(
  '/messages/:messageId',
  validate(schemas.messageIdParamSchema),
  asyncHandler(controller.adminDeleteMessage)
);
