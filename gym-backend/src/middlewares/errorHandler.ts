import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { logger } from '@/config/logger';
import { env } from '@/config/env';

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  const isAppError = err instanceof AppError;
  const isMulterError = err instanceof MulterError;
  const statusCode = isAppError ? err.statusCode : isMulterError ? 400 : 500;
  const message = err instanceof Error ? err.message : 'Internal server error';

  logger.error(message, { statusCode, stack: err instanceof Error ? err.stack : undefined });

  res.status(statusCode).json({
    error: {
      message: statusCode === 500 && env.NODE_ENV === 'production' ? 'Internal server error' : message,
      details: isAppError ? err.details : undefined,
    },
  });
}
