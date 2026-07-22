import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { OtpPurpose, Role, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/middlewares/errorHandler';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { generateOtp } from '@/lib/otp';
import { sendMail } from '@/lib/mailer';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

function sanitizeUser(user: User) {
  const { passwordHash, ...rest } = user;
  return rest;
}

async function issueTokens(user: Pick<User, 'id' | 'role'>) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

async function issueOtp(userId: string, email: string, purpose: OtpPurpose) {
  const code = generateOtp();
  await prisma.otpCode.create({
    data: { userId, code, purpose, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const subject = purpose === OtpPurpose.EMAIL_VERIFICATION ? 'Verify your email' : 'Reset your password';
  await sendMail(email, subject, `<p>Your verification code is <b>${code}</b>. It expires in 10 minutes.</p>`);
}

export async function register(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email already registered', 409);

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: Role.USER },
  });

  await issueOtp(user.id, email, OtpPurpose.EMAIL_VERIFICATION);

  return sanitizeUser(user);
}

export async function verifyEmail(email: string, code: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid email or code', 400);

  const otp = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      code,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new AppError('Invalid or expired code', 400);

  const [, updatedUser] = await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true } }),
  ]);

  const tokens = await issueTokens(updatedUser);
  return { user: sanitizeUser(updatedUser), ...tokens };
}

export async function resendOtp(email: string, purpose: OtpPurpose) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // do not leak account existence
  await issueOtp(user.id, email, purpose);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new AppError('Invalid credentials', 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid credentials', 401);

  if (!user.isEmailVerified) throw new AppError('Email not verified', 403);
  if (user.accountStatus !== 'ACTIVE') {
    throw new AppError(`Account is ${user.accountStatus.toLowerCase()}`, 403);
  }

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
}

export async function refresh(oldRefreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: oldRefreshToken } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError('Invalid refresh token', 401);

  // Rotation: revoke the used token before issuing a new pair
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  return issueTokens(user);
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function forgotPassword(email: string) {
  await resendOtp(email, OtpPurpose.PASSWORD_RESET);
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid email or code', 400);

  const otp = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      code,
      purpose: OtpPurpose.PASSWORD_RESET,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new AppError('Invalid or expired code', 400);

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);

  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function googleLogin(idToken: string) {
  if (!googleClient) throw new AppError('Google login is not configured', 501);

  const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new AppError('Invalid Google token', 401);

  let user = await prisma.user.findUnique({ where: { email: payload.email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: payload.email,
        googleId: payload.sub,
        name: payload.name,
        photoUrl: payload.picture,
        role: Role.USER,
        isEmailVerified: true,
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
  }

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
}
