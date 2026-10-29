import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '@/middlewares/errorHandler';

export function validate(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
      // Hand handlers the parsed body, not the raw one: zod strips keys the schema
      // doesn't declare, so a request can't smuggle in fields like `role` or `coins`
      // that a handler then passes straight to Prisma.
      if (parsed.body !== undefined) req.body = parsed.body;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new AppError('Validation failed', 422, err.flatten().fieldErrors));
      }
      next(err);
    }
  };
}
