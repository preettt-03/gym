import { Server } from 'socket.io';
import { MessageType } from '@prisma/client';
import { AuthedSocket } from '@/lib/socket';
import { logger } from '@/config/logger';
import * as service from '@/features/chat/chat.service';

type Ack = (res: { ok: boolean; error?: string; [key: string]: unknown }) => void;

export function registerChatSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    const authedSocket = socket as AuthedSocket;
    const { userId } = authedSocket.data;

    socket.on('chat:join', async (payload: { roomId: string }, ack?: Ack) => {
      try {
        await service.assertRoomAccess(payload.roomId, userId);
        socket.join(`room:${payload.roomId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed to join room' });
      }
    });

    socket.on('chat:leave', (payload: { roomId: string }) => {
      socket.leave(`room:${payload.roomId}`);
    });

    socket.on(
      'chat:message',
      async (
        payload: { roomId: string; type?: MessageType; content?: string; mediaUrl?: string },
        ack?: Ack
      ) => {
        try {
          const message = await service.sendMessage(userId, payload.roomId, {
            type: payload.type ?? 'TEXT',
            content: payload.content,
            mediaUrl: payload.mediaUrl,
          });
          io.to(`room:${payload.roomId}`).emit('chat:message', message);
          ack?.({ ok: true, message });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed to send message' });
        }
      }
    );

    socket.on('chat:typing', (payload: { roomId: string }) => {
      socket.to(`room:${payload.roomId}`).emit('chat:typing', { roomId: payload.roomId, userId });
    });

    socket.on('chat:read', async (payload: { roomId: string; messageId: string }) => {
      try {
        await service.markRead(payload.roomId, userId, payload.messageId);
        io.to(`room:${payload.roomId}`).emit('chat:read', {
          roomId: payload.roomId,
          userId,
          messageId: payload.messageId,
        });
      } catch (err) {
        logger.warn('chat:read failed', { err });
      }
    });
  });
}
