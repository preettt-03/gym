import { Response, Router } from 'express';
import { AccountStatus, Role } from '@prisma/client';
import { AppError } from '@/middlewares/errorHandler';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { AuthedRequest, requireAuth, requireRole } from '@/middlewares/auth';
import { parsePagination } from '@/lib/pagination';
import * as schemas from '@/features/admin-users/admin-users.schemas';
import { sendAdminPasswordReset } from '@/features/auth/auth.service';
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

// An admin locking themselves out (demote, suspend, delete) can leave the gym
// with no admin at all, so those actions only work on other accounts.
function forbidSelf(req: AuthedRequest, action: string) {
  if (req.params.id === req.user!.id) throw new AppError(`You can't ${action} your own account`, 400);
}

adminUsersRouter.patch(
  '/:id',
  validate(schemas.updateUserSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (req.body.role !== undefined || req.body.accountStatus !== undefined) forbidSelf(req, 'change the role or status of');
    res.json({ user: await service.updateUser(req.params.id, req.body) });
  })
);

adminUsersRouter.delete(
  '/:id',
  validate(schemas.userIdParamSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    forbidSelf(req, 'delete');
    await service.deleteUser(req.params.id);
    res.status(204).send();
  })
);

adminUsersRouter.post(
  '/:id/reset-password',
  validate(schemas.resetPasswordSchema),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    forbidSelf(req, 'send a reset email for');
    const { email } = await sendAdminPasswordReset(req.params.id);
    res.json({ message: `Password reset email sent to ${email}`, email });
  })
);
