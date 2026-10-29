import { Request, Response } from 'express';
import { OtpPurpose } from '@prisma/client';
import { env } from '@/config/env';
import * as authService from '@/features/auth/auth.service';
import { AppError } from '@/middlewares/errorHandler';

const REFRESH_COOKIE = 'refreshToken';
const ADMIN_REFRESH_COOKIE = 'adminRefreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Cookies are shared across ports, so on one host the member site and the admin
// panel would otherwise overwrite each other's session — a member signing in on
// the site silently turned the admin panel into a member session (403 everywhere).
// The admin panel identifies itself with `X-Client: admin` and gets its own cookie.
function isAdminClient(req: Request) {
  return req.get('x-client') === 'admin';
}

function cookieName(req: Request) {
  return isAdminClient(req) ? ADMIN_REFRESH_COOKIE : REFRESH_COOKIE;
}

function setRefreshCookie(req: Request, res: Response, token: string) {
  res.cookie(cookieName(req), token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: REFRESH_COOKIE_PATH,
  });
}

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body;
  const user = await authService.register(email, password, name);
  res.status(201).json({ user, message: 'Registered. Check your email for the verification code.' });
}

export async function verifyEmail(req: Request, res: Response) {
  const { email, code } = req.body;
  const { user, accessToken, refreshToken } = await authService.verifyEmail(email, code);
  setRefreshCookie(req, res, refreshToken);
  res.json({ user, accessToken });
}

export async function resendOtp(req: Request, res: Response) {
  const { email } = req.body;
  await authService.resendOtp(email, OtpPurpose.EMAIL_VERIFICATION);
  res.json({ message: 'If the account exists, a new code has been sent.', cooldownSeconds: authService.OTP_RESEND_COOLDOWN_SECONDS });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(email, password);
  if (isAdminClient(req) && user.role !== 'ADMIN') {
    await authService.logout(refreshToken);
    throw new AppError('This account does not have admin access.', 403);
  }
  setRefreshCookie(req, res, refreshToken);
  res.json({ user, accessToken });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[cookieName(req)];
  if (!token) {
    return res.status(401).json({ error: { message: 'Missing refresh token' } });
  }
  const { accessToken, refreshToken } = await authService.refresh(token, isAdminClient(req) ? ['ADMIN'] : undefined);
  setRefreshCookie(req, res, refreshToken);
  res.json({ accessToken });
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[cookieName(req)];
  if (token) await authService.logout(token);
  res.clearCookie(cookieName(req), { path: REFRESH_COOKIE_PATH });
  res.json({ message: 'Logged out' });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  await authService.forgotPassword(email);
  res.json({ message: 'If the account exists, a reset code has been sent.', cooldownSeconds: authService.OTP_RESEND_COOLDOWN_SECONDS });
}

export async function resetPassword(req: Request, res: Response) {
  const { email, code, newPassword } = req.body;
  await authService.resetPassword(email, code, newPassword);
  res.json({ message: 'Password reset successful' });
}

export async function googleLogin(req: Request, res: Response) {
  const { idToken } = req.body;
  const { user, accessToken, refreshToken } = await authService.googleLogin(idToken);
  setRefreshCookie(req, res, refreshToken);
  res.json({ user, accessToken });
}
