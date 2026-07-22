import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { calculateBodyFatPercent } from '@/lib/health-calculators';

export const calculatorsRouter = Router();

const bodyFatSchema = z.object({
  body: z.object({
    gender: z.enum(['MALE', 'FEMALE']),
    heightCm: z.number().positive(),
    neckCm: z.number().positive(),
    waistCm: z.number().positive(),
    hipCm: z.number().positive().optional(),
  }),
});

calculatorsRouter.post(
  '/body-fat',
  validate(bodyFatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { gender, heightCm, neckCm, waistCm, hipCm } = req.body;
    const bodyFatPercent = calculateBodyFatPercent(gender, heightCm, neckCm, waistCm, hipCm);
    res.json({ bodyFatPercent });
  })
);
