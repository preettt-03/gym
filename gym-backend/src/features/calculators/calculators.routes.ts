import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AppError } from '@/middlewares/errorHandler';
import { calculateBodyFatPercent } from '@/lib/health-calculators';

export const calculatorsRouter = Router();

const cm = (label: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(min, `${label} must be at least ${min} cm`)
    .max(max, `${label} must be at most ${max} cm`);

const bodyFatSchema = z.object({
  body: z
    .object({
      gender: z.enum(['MALE', 'FEMALE']),
      heightCm: cm('Height', 100, 250),
      neckCm: cm('Neck', 20, 80),
      waistCm: cm('Waist', 40, 200),
      hipCm: cm('Hip', 50, 200).optional(),
    })
    .refine((b) => b.gender === 'MALE' || b.hipCm !== undefined, {
      path: ['hipCm'],
      message: 'Hip measurement is required for women',
    })
    // The formula takes log10(waist - neck) (men) or log10(waist + hip - neck)
    // (women); a non-positive difference is a measuring mistake, not a result.
    .refine((b) => (b.gender === 'MALE' ? b.waistCm : b.waistCm + (b.hipCm ?? 0)) > b.neckCm, {
      path: ['waistCm'],
      message: 'Waist must be larger than neck — please re-measure',
    }),
});

// American Council on Exercise ranges, shown alongside the estimate.
const CATEGORIES = {
  MALE: [
    { max: 5, label: 'Essential fat' },
    { max: 13, label: 'Athletic' },
    { max: 17, label: 'Fitness' },
    { max: 24, label: 'Average' },
    { max: Infinity, label: 'Above average' },
  ],
  FEMALE: [
    { max: 13, label: 'Essential fat' },
    { max: 20, label: 'Athletic' },
    { max: 24, label: 'Fitness' },
    { max: 31, label: 'Average' },
    { max: Infinity, label: 'Above average' },
  ],
} as const;

calculatorsRouter.post(
  '/body-fat',
  validate(bodyFatSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { gender, heightCm, neckCm, waistCm, hipCm } = req.body as z.infer<typeof bodyFatSchema>['body'];
    const bodyFatPercent = calculateBodyFatPercent(gender, heightCm, neckCm, waistCm, hipCm);

    // Outside this band the inputs are almost certainly mis-measured.
    if (!Number.isFinite(bodyFatPercent) || bodyFatPercent < 2 || bodyFatPercent > 60) {
      throw new AppError("These measurements don't produce a realistic estimate — please re-measure", 422);
    }

    const category = CATEGORIES[gender].find((c) => bodyFatPercent <= c.max)!.label;
    res.json({ bodyFatPercent, category, method: 'U.S. Navy circumference method' });
  })
);
