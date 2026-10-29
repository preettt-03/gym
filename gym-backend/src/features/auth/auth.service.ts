import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { OtpPurpose, Role, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/middlewares/errorHandler';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { generateOtp } from '@/lib/otp';
import { sendMail } from '@/lib/mailer';
import { redis } from '@/lib/redis';
import { logger } from '@/config/logger';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
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

// Stores a fresh code and emails it. A mail outage must never fail a
// self-service request (the user can press "Resend code"), so delivery errors
// are logged, not thrown. By default the email is sent in the background —
// SMTP can take seconds — and the call resolves immediately; pass
// waitForDelivery when the caller needs to know whether it went out.
async function issueOtp(userId: string, email: string, purpose: OtpPurpose, { waitForDelivery = false } = {}) {
  const code = generateOtp();
  // Only the newest code is ever valid, so resends don't multiply the odds of a guess.
  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.otpCode.create({
      data: { userId, code, purpose, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    }),
  ]);

  const resetUrl = `${env.USER_APP_URL}/reset-password?email=${encodeURIComponent(email)}`;
  const [subject, html] =
    purpose === OtpPurpose.EMAIL_VERIFICATION
      ? ['Verify your email', `<p>Your verification code is <b>${code}</b>. It expires in 10 minutes.</p>`]
      : [
          'Reset your password',
          `<p>Your password reset code is <b>${code}</b>. It expires in 10 minutes.</p>` +
            `<p><a href="${resetUrl}">Choose a new password</a></p>` +
            `<p>If you didn't ask for this, you can ignore this email — your password won't change.</p>`,
        ];

  const delivery = sendMail(email, subject, html).then(
    () => true,
    (err) => {
      logger.error('Failed to send OTP email', { purpose, userId, err: err instanceof Error ? err.message : err });
      return false;
    }
  );
  return waitForDelivery ? delivery : true;
}

function codesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Checks a submitted code against the user's single active OTP. Each wrong
// guess counts against that code, which is burned after OTP_MAX_ATTEMPTS.
async function consumeOtp(userId: string, purpose: OtpPurpose, code: string) {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new AppError('Invalid or expired code', 400);

  if (!codesMatch(otp.code, code)) {
    const attempts = otp.attempts + 1;
    const exhausted = attempts >= OTP_MAX_ATTEMPTS;
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts, ...(exhausted && { consumedAt: new Date() }) },
    });
    throw new AppError(
      exhausted ? 'Too many incorrect attempts. Request a new code.' : 'Invalid or expired code',
      400
    );
  }

  return otp;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Marks the OTP used inside a transaction; fails if a concurrent request got there first.
async function markOtpConsumed(tx: Tx, otpId: string) {
  const { count } = await tx.otpCode.updateMany({
    where: { id: otpId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count !== 1) throw new AppError('Invalid or expired code', 400);
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
  if (!user) throw new AppError('Invalid or expired code', 400);

  const otp = await consumeOtp(user.id, OtpPurpose.EMAIL_VERIFICATION, code);

  const updatedUser = await prisma.$transaction(async (tx) => {
    await markOtpConsumed(tx, otp.id);
    return tx.user.update({ where: { id: user.id }, data: { isEmailVerified: true } });
  });

  const tokens = await issueTokens(updatedUser);
  return { user: sanitizeUser(updatedUser), ...tokens };
}

// Silently does nothing for unknown emails, already-verified accounts, or
// requests inside the cooldown, so the response never reveals account state.
export async function resendOtp(email: string, purpose: OtpPurpose) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  if (purpose === OtpPurpose.EMAIL_VERIFICATION && user.isEmailVerified) return;

  const latest = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) return;

  await issueOtp(user.id, email, purpose);
}

export const LOGIN_MAX_ATTEMPTS = 3;
export const LOGIN_LOCK_SECONDS = 30;
// Wrong attempts are forgotten after this long without hitting the limit.
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;

const failKey = (email: string) => `login:fail:${email.toLowerCase()}`;
const lockKey = (email: string) => `login:lock:${email.toLowerCase()}`;

function lockedError(seconds: number) {
  return new AppError(`Too many wrong attempts. Try again in ${seconds} seconds.`, 429, {
    code: 'LOGIN_LOCKED',
    retryAfterSeconds: seconds,
  });
}

// The lock is a convenience against guessing, not the only defence (the auth rate
// limiter still applies), so a Redis outage must never block logins — fail open.
async function lockSecondsLeft(email: string) {
  try {
    const ttl = await redis.ttl(lockKey(email));
    return ttl > 0 ? ttl : 0;
  } catch (err) {
    logger.error('Login lock check failed', { err });
    return 0;
  }
}

async function recordFailedLogin(email: string): Promise<{ attemptsLeft: number; locked: boolean }> {
  try {
    const [[, count]] = (await redis.multi().incr(failKey(email)).expire(failKey(email), LOGIN_FAIL_WINDOW_SECONDS).exec()) as [[unknown, number]];
    if (count >= LOGIN_MAX_ATTEMPTS) {
      await redis.multi().set(lockKey(email), '1', 'EX', LOGIN_LOCK_SECONDS).del(failKey(email)).exec();
      return { attemptsLeft: 0, locked: true };
    }
    return { attemptsLeft: LOGIN_MAX_ATTEMPTS - count, locked: false };
  } catch (err) {
    logger.error('Recording failed login failed', { err });
    return { attemptsLeft: LOGIN_MAX_ATTEMPTS, locked: false };
  }
}

async function clearFailedLogins(email: string) {
  await redis.del(failKey(email), lockKey(email)).catch((err) => logger.error('Clearing login attempts failed', { err }));
}

// Errors carry a machine-readable `details.code` so the apps can react (link to
// sign-up, show a countdown) without matching on message text.
export async function login(email: string, password: string) {
  const locked = await lockSecondsLeft(email);
  if (locked) throw lockedError(locked);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    // Counted like a wrong password so hammering unknown emails gets locked too.
    const { locked: nowLocked } = await recordFailedLogin(email);
    if (nowLocked) throw lockedError(LOGIN_LOCK_SECONDS);
    throw new AppError('No user found with this account.', 404, { code: 'USER_NOT_FOUND' });
  }
  if (!user.passwordHash) {
    throw new AppError('This account uses Google sign-in. Continue with Google instead.', 400, { code: 'GOOGLE_ACCOUNT' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const { attemptsLeft, locked: nowLocked } = await recordFailedLogin(email);
    if (nowLocked) throw lockedError(LOGIN_LOCK_SECONDS);
    throw new AppError(
      `Incorrect password. ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left before a ${LOGIN_LOCK_SECONDS}-second lock.`,
      401,
      { code: 'WRONG_PASSWORD', attemptsLeft }
    );
  }
  await clearFailedLogins(email);

  if (!user.isEmailVerified) throw new AppError('Email not verified', 403, { code: 'EMAIL_NOT_VERIFIED' });
  if (user.accountStatus !== 'ACTIVE') {
    throw new AppError(`Account is ${user.accountStatus.toLowerCase()}`, 403, { code: 'ACCOUNT_INACTIVE' });
  }

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
}

export async function refresh(oldRefreshToken: string, allowedRoles?: Role[]) {
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
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // e.g. the admin was demoted: end this session instead of minting a token every route rejects.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    throw new AppError('Invalid refresh token', 401);
  }

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

// Admin-initiated reset: emails the member a reset code and signs them out
// everywhere. The admin never sees or chooses the new password.
export async function sendAdminPasswordReset(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new AppError('User not found', 404);

  const latest = await prisma.otpCode.findFirst({
    where: { userId, purpose: OtpPurpose.PASSWORD_RESET },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    throw new AppError('A reset email was sent less than a minute ago. Try again shortly.', 429);
  }

  // Unlike self-service flows, the admin needs to know if the email didn't go out.
  const delivered = await issueOtp(user.id, user.email, OtpPurpose.PASSWORD_RESET, { waitForDelivery: true });
  if (!delivered) throw new AppError("Couldn't send the reset email. Check the mail settings and try again in a minute.", 502);

  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return { email: user.email };
}

export async function forgotPassword(email: string) {
  await resendOtp(email, OtpPurpose.PASSWORD_RESET);
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid or expired code', 400);

  const otp = await consumeOtp(user.id, OtpPurpose.PASSWORD_RESET, code);

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await markOtpConsumed(tx, otp.id);
    // The code arrived by email, so a successful reset also proves the address.
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, isEmailVerified: true } });
    // Sign out every existing session.
    await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  });
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
