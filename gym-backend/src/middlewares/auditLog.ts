import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AuthedRequest } from '@/middlewares/auth';
import { logger } from '@/config/logger';

const SENSITIVE_KEYS = ['password', 'newPassword', 'passwordHash'];

function sanitizeBody(body: unknown): Prisma.InputJsonValue | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of SENSITIVE_KEYS) {
    if (key in clone) clone[key] = '[REDACTED]';
  }
  return clone as Prisma.InputJsonValue;
}

function extractEntity(path: string): { entityType?: string; entityId?: string } {
  // e.g. /api/v1/admin/users/abc-123 -> entityType=users, entityId=abc-123
  const segments = path.split('/').filter(Boolean);
  const adminIndex = segments.indexOf('admin');
  if (adminIndex === -1) return {};

  const entityType = segments[adminIndex + 1];
  const maybeId = segments[adminIndex + 2];
  const isUuid = maybeId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maybeId) : false;
  return { entityType, entityId: isUuid ? maybeId : undefined };
}

// Mounted ahead of every /api/v1/admin/* router. Registers a `finish` listener before the
// request continues down the chain — by the time the response actually finishes, whichever
// admin router handled it has already run requireAuth and populated req.user, so this reads
// a real admin id without needing auth logic duplicated here.
export function auditLog(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.method === 'GET') return next();

  // req.path is relative to wherever this middleware is mounted, not the full URL —
  // req.originalUrl is the one that's stable regardless of router nesting.
  const fullPath = req.originalUrl.split('?')[0];

  res.on('finish', () => {
    if (!req.user) return;
    const { entityType, entityId } = extractEntity(fullPath);

    prisma.auditLog
      .create({
        data: {
          adminId: req.user.id,
          action: `${req.method} ${fullPath}`,
          method: req.method,
          path: fullPath,
          entityType,
          entityId,
          statusCode: res.statusCode,
          details: sanitizeBody(req.body),
          ipAddress: req.ip,
        },
      })
      .catch((err) => logger.error('Failed to write audit log', { err }));
  });

  next();
}
