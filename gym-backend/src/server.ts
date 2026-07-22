import http from 'http';
import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { prisma } from '@/lib/prisma';
import { initSocket } from '@/lib/socket';
import { registerChatSocketHandlers } from '@/features/chat/chat.socket';
import { startNotificationSubscriber } from '@/lib/notification-subscriber';

const app = createApp();
const httpServer = http.createServer(app);

const io = initSocket(httpServer);
registerChatSocketHandlers(io);
const notificationSubscriber = startNotificationSubscriber();

const server = httpServer.listen(env.PORT, () => {
  logger.info(`gym-backend listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);

  // http.Server#close() only fires its callback once every open connection
  // ends — Socket.IO connections are long-lived by design, so with even one
  // connected client this would hang forever. Force-exit after a bounded
  // window so SIGTERM always actually terminates the process (matching the
  // ~10s window Docker/orchestrators give before sending SIGKILL).
  const forceExitTimer = setTimeout(() => {
    logger.warn('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  io.close();
  server.close(async () => {
    await notificationSubscriber.quit();
    await prisma.$disconnect();
    clearTimeout(forceExitTimer);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
