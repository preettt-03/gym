import { Router } from 'express';
import { validate } from '@/middlewares/validate';
import { asyncHandler } from '@/middlewares/asyncHandler';
import { authRateLimiter } from '@/middlewares/rateLimiter';
import * as controller from '@/features/auth/auth.controller';
import * as schemas from '@/features/auth/auth.schemas';

export const authRouter = Router();

authRouter.use(authRateLimiter);

authRouter.post('/register', validate(schemas.registerSchema), asyncHandler(controller.register));
authRouter.post('/verify-email', validate(schemas.verifyEmailSchema), asyncHandler(controller.verifyEmail));
authRouter.post('/resend-otp', validate(schemas.emailOnlySchema), asyncHandler(controller.resendOtp));
authRouter.post('/login', validate(schemas.loginSchema), asyncHandler(controller.login));
authRouter.post('/refresh', asyncHandler(controller.refresh));
authRouter.post('/logout', asyncHandler(controller.logout));
authRouter.post('/forgot-password', validate(schemas.emailOnlySchema), asyncHandler(controller.forgotPassword));
authRouter.post('/reset-password', validate(schemas.resetPasswordSchema), asyncHandler(controller.resetPassword));
authRouter.post('/google', validate(schemas.googleLoginSchema), asyncHandler(controller.googleLogin));
