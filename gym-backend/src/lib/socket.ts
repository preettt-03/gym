import type { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Role } from '@prisma/client';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { verifyAccessToken } from '@/lib/jwt';

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    role: Role;
  };
}

let io: Server | null = null;

// Presence tracking is in-memory, so it's per-process. Fine for a single backend instance;
// scaling to multiple instances would need a Redis-backed presence set instead.
const onlineUsers = new Map<string, Set<string>>(); // userId -> set of socket ids

export function initSocket(httpServer: HttpServer) {
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));

    try {
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).data = { userId: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const authedSocket = socket as AuthedSocket;
    const { userId } = authedSocket.data;

    socket.join(`user:${userId}`);

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);
    io!.emit('presence:online', { userId });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      sockets?.delete(socket.id);
      if (sockets && sockets.size === 0) {
        onlineUsers.delete(userId);
        io!.emit('presence:offline', { userId });
      }
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

// Realtime delivery is best-effort on top of data that's already persisted
// (e.g. a Notification row) — a missing Socket.IO instance (tests, scripts,
// any context that skips the full server bootstrap) should never fail the
// underlying request, just skip the push.
export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!io) {
    logger.warn('emitToUser called before Socket.IO was initialized; skipping realtime push', { userId, event });
    return;
  }
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToRoom(roomId: string, event: string, payload: unknown) {
  if (!io) {
    logger.warn('emitToRoom called before Socket.IO was initialized; skipping realtime push', { roomId, event });
    return;
  }
  io.to(`room:${roomId}`).emit(event, payload);
}
