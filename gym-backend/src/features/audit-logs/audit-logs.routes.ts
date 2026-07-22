import { Response, Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const auditLogsRouter = Router();
auditLogsRouter.use(requireAuth, requireRole(Role.ADMIN));

const listSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    adminId: z.string().uuid().optional(),
    entityType: z.string().optional(),
    action: z.string().optional(),
  }),
});

auditLogsRouter.get(
  '/',
  validate(listSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const { adminId, entityType, action } = req.query as Record<string, string | undefined>;

    const where: Prisma.AuditLogWhereInput = {};
    if (adminId) where.adminId = adminId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  })
);
