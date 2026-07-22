import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { AppError } from '@/middlewares/errorHandler';
import { getReport, ReportType } from '@/features/reports/reports.service';
import { ReportFormat, sendReport } from '@/lib/export';

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole(Role.ADMIN));

const REPORT_TYPES: ReportType[] = ['revenue', 'attendance', 'membership', 'users', 'workout', 'diet'];

const reportSchema = z.object({
  params: z.object({ type: z.enum(['revenue', 'attendance', 'membership', 'users', 'workout', 'diet']) }),
  query: z.object({
    format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

reportsRouter.get(
  '/:type',
  validate(reportSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const type = req.params.type as ReportType;
    if (!REPORT_TYPES.includes(type)) throw new AppError('Unknown report type', 400);

    const { format, from, to } = req.query as { format: ReportFormat; from?: string; to?: string };

    const { title, headers, rows } = await getReport(type, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    await sendReport(res, format, `${type}-report`, title, headers, rows);
  })
);
