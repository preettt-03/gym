import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AuthedRequest } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import { emitToRoom } from '@/lib/socket';
import * as service from '@/features/chat/chat.service';

export async function listRooms(req: AuthedRequest, res: Response) {
  res.json(await service.listMyRooms(req.user!.id));
}

export async function listPublicGlobalMessages(_req: Request, res: Response) {
  res.json(await service.listPublicGlobalMessages());
}

export async function getOrCreateDirect(req: AuthedRequest, res: Response) {
  const room = await service.getOrCreateDirectRoom(req.user!.id, req.body.userId);
  res.status(201).json({ room });
}

export async function sendMessage(req: AuthedRequest, res: Response) {
  const message = await service.sendMessage(req.user!.id, req.params.roomId, req.body);
  emitToRoom(req.params.roomId, 'chat:message', message);
  res.status(201).json({ message });
}

export async function listMessages(req: AuthedRequest, res: Response) {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  res.json(await service.listMessages(req.params.roomId, req.user!.id, pagination, before));
}

export async function unreadCounts(req: AuthedRequest, res: Response) {
  res.json(await service.getUnreadCounts(req.user!.id));
}

export async function markRead(req: AuthedRequest, res: Response) {
  await service.markRead(req.params.roomId, req.user!.id, req.body.messageId);
  emitToRoom(req.params.roomId, 'chat:read', {
    roomId: req.params.roomId,
    userId: req.user!.id,
    messageId: req.body.messageId,
  });
  res.json({ message: 'Marked read' });
}

export async function deleteMessage(req: AuthedRequest, res: Response) {
  const roomId = await service.deleteMessage(req.user!.id, req.user!.role, req.params.messageId);
  emitToRoom(roomId, 'chat:messageDeleted', { messageId: req.params.messageId });
  res.status(204).send();
}

export async function blockUser(req: AuthedRequest, res: Response) {
  await service.blockUser(req.user!.id, req.params.userId);
  res.json({ message: 'User blocked' });
}

export async function unblockUser(req: AuthedRequest, res: Response) {
  await service.unblockUser(req.user!.id, req.params.userId);
  res.json({ message: 'User unblocked' });
}

export async function reportMessage(req: AuthedRequest, res: Response) {
  const report = await service.reportMessage(req.user!.id, req.params.messageId, req.body.reason);
  res.status(201).json({ report });
}

// --- Admin ---

export async function createChannel(req: AuthedRequest, res: Response) {
  const room = await service.createChannel(req.user!.id, req.body.name);
  res.status(201).json({ room });
}

export async function listAllChannels(_req: AuthedRequest, res: Response) {
  res.json({ channels: await service.listAllChannels() });
}

export async function addChannelMembers(req: AuthedRequest, res: Response) {
  await service.addChannelMembers(req.params.roomId, req.body.userIds);
  res.json({ message: 'Members added' });
}

export async function removeChannelMember(req: AuthedRequest, res: Response) {
  await service.removeChannelMember(req.params.roomId, req.params.userId);
  res.status(204).send();
}

export async function pinMessage(req: AuthedRequest, res: Response) {
  const message = await service.togglePin(req.params.messageId, true);
  emitToRoom(message.roomId, 'chat:messagePinned', message);
  res.json({ message });
}

export async function unpinMessage(req: AuthedRequest, res: Response) {
  const message = await service.togglePin(req.params.messageId, false);
  emitToRoom(message.roomId, 'chat:messagePinned', message);
  res.json({ message });
}

export async function adminDeleteMessage(req: AuthedRequest, res: Response) {
  const roomId = await service.deleteMessage(req.user!.id, Role.ADMIN, req.params.messageId);
  emitToRoom(roomId, 'chat:messageDeleted', { messageId: req.params.messageId });
  res.status(204).send();
}
