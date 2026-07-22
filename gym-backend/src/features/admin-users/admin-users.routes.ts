import { Response, Router } from 'express';
import { AccountStatus, Role } from '@prisma/client';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import * as schemas from '@/features/admin-users/admin-users.schemas';
import * as service from '@/features/admin-users/admin-users.service';

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAuth, requireRole(Role.ADMIN));

adminUsersRouter.get(
  '/',
  validate(schemas.listUsersSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const { search, role, accountStatus } = req.query as Record<string, string | undefined>;
    const result = await service.listUsers(
      { search, role: role as Role | undefined, accountStatus: accountStatus as AccountStatus | undefined },
      pagination
    );
    res.json(result);
  })
);

adminUsersRouter.get(
  '/:id',
  validate(schemas.userIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ user: await service.getUserDetail(req.params.id) });
  })
);

adminUsersRouter.patch(
  '/:id',
  validate(schemas.updateUserSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    res.json({ user: await service.updateUser(req.params.id, req.body) });
  })
);

adminUsersRouter.delete(
  '/:id',
  validate(schemas.userIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.deleteUser(req.params.id);
    res.status(204).send();
  })
);

adminUsersRouter.post(
  '/:id/reset-password',
  validate(schemas.resetPasswordSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    await service.resetUserPassword(req.params.id, req.body.newPassword);
    res.json({ message: 'Password reset' });
  })
);
