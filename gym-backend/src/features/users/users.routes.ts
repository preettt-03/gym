import { Router } from 'express';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { validate } from '@/middlewares/validate';
import { requireAuth } from '@/middlewares/auth';
import { upload } from '@/lib/upload';
import * as controller from '@/features/users/users.controller';
import * as schemas from '@/features/users/users.schemas';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', asyncHandler(controller.me));
usersRouter.patch('/me/profile', validate(schemas.updateProfileSchema), asyncHandler(controller.updateProfile));
usersRouter.put('/me/photo', upload.single('photo'), asyncHandler(controller.uploadPhoto));
usersRouter.delete('/me/photo', asyncHandler(controller.removePhoto));
usersRouter.get('/me/dashboard', asyncHandler(controller.dashboard));
usersRouter.post('/me/weight-logs', validate(schemas.logWeightSchema), asyncHandler(controller.logWeight));
usersRouter.get('/me/weight-logs', asyncHandler(controller.weightLogs));

// Contact details are changed by proving them with a one-time code.
usersRouter.post('/me/phone/send-otp', validate(schemas.sendPhoneOtpSchema), asyncHandler(controller.sendPhoneOtp));
usersRouter.post('/me/phone/verify', validate(schemas.verifyPhoneSchema), asyncHandler(controller.verifyPhone));
usersRouter.delete('/me/phone', asyncHandler(controller.removePhone));
usersRouter.post('/me/email/send-otp', validate(schemas.sendEmailOtpSchema), asyncHandler(controller.sendEmailOtp));
usersRouter.post('/me/email/verify', validate(schemas.verifyEmailChangeSchema), asyncHandler(controller.verifyEmailChange));
