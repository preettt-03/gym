import bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middlewares/errorHandler';
import { maskPhone, normalizePhone } from '@/lib/phone';
import { isPhoneAuthAvailable, sendOtpSms } from '@/lib/sms';
import { sendMail } from '@/lib/mailer';
import { CONTACT_OTP_COOLDOWN_SECONDS, consumeContactOtp, issueContactOtp } from '@/features/auth/contact-otp';
import { issueTokens, PASSWORD_SALT_ROUNDS, sanitizeUser } from '@/features/auth/auth.service';
import { maskEmail, parseIdentifier } from '@/lib/identifier';

export type PhoneMode = 'login' | 'signup';

export function requirePhone(raw: string) {
  const phone = normalizePhone(raw);
  if (!phone) throw new AppError('Enter a valid mobile number, e.g. 98765 43210', 422, { code: 'INVALID_PHONE' });
  return phone;
}

const findByPhone = (phone: string) => prisma.user.findFirst({ where: { phone, deletedAt: null } });

/** Step 1 of mobile sign-in / sign-up: text a code to the number. */
export async function sendPhoneOtp(rawPhone: string, mode: PhoneMode, name?: string, password?: string) {
  if (!isPhoneAuthAvailable) throw new AppError('Mobile sign-in is not available yet — use email or Google', 503);
  const phone = requirePhone(rawPhone);
  const existing = await findByPhone(phone);

  if (mode === 'login' && !existing) throw new AppError('No user found with this number.', 404, { code: 'USER_NOT_FOUND' });
  if (mode === 'signup' && existing) throw new AppError('This number is already registered. Log in instead.', 409, { code: 'PHONE_TAKEN' });
  if (existing && existing.accountStatus !== 'ACTIVE') throw new AppError(`Account is ${existing.accountStatus.toLowerCase()}`, 403);

  // The chosen password waits with the code — hashed, never in plain text — until the number is proven.
  const data = mode === 'signup' ? { name: name ?? '', ...(password ? { passwordHash: await bcrypt.hash(password, PASSWORD_SALT_ROUNDS) } : {}) } : undefined;
  const code = await issueContactOtp(mode === 'login' ? 'phone-login' : 'phone-signup', phone, data);
  await sendOtpSms(phone, code);
  return { phone: maskPhone(phone), cooldownSeconds: CONTACT_OTP_COOLDOWN_SECONDS };
}

/** Step 2: check the code, creating the account on sign-up, and sign in. */
export async function verifyPhoneOtp(rawPhone: string, code: string, mode: PhoneMode) {
  const phone = requirePhone(rawPhone);
  const data = await consumeContactOtp(mode === 'login' ? 'phone-login' : 'phone-signup', phone, code);

  let user = await findByPhone(phone);
  if (mode === 'signup') {
    if (user) throw new AppError('This number is already registered. Log in instead.', 409, { code: 'PHONE_TAKEN' });
    try {
      user = await prisma.user.create({ data: { phone, isPhoneVerified: true, name: data.name || null, passwordHash: data.passwordHash || null, role: Role.USER } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new AppError('This number is already registered. Log in instead.', 409);
      throw err;
    }
  } else {
    if (!user) throw new AppError('No user found with this number.', 404, { code: 'USER_NOT_FOUND' });
    if (user.accountStatus !== 'ACTIVE') throw new AppError(`Account is ${user.accountStatus.toLowerCase()}`, 403);
    // Admin-entered numbers become verified the first time the member proves them.
    if (!user.isPhoneVerified) user = await prisma.user.update({ where: { id: user.id }, data: { isPhoneVerified: true } });
  }

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
}

// ---------------------------------------------------------------------------
// Adding / changing contact details from the member's own profile
// ---------------------------------------------------------------------------

export async function sendAddPhoneOtp(userId: string, rawPhone: string) {
  if (!isPhoneAuthAvailable) throw new AppError('SMS is not set up yet, so numbers can’t be verified', 503);
  const phone = requirePhone(rawPhone);
  const owner = await findByPhone(phone);
  if (owner?.id === userId) throw new AppError('This is already your number', 409);
  if (owner) throw new AppError('This number is used by another account', 409, { code: 'PHONE_TAKEN' });
  const code = await issueContactOtp('add-phone', phone, { userId });
  await sendOtpSms(phone, code);
  return { phone: maskPhone(phone), cooldownSeconds: CONTACT_OTP_COOLDOWN_SECONDS };
}

export async function verifyAddPhone(userId: string, rawPhone: string, code: string) {
  const phone = requirePhone(rawPhone);
  const data = await consumeContactOtp('add-phone', phone, code);
  if (data.userId !== userId) throw new AppError('This code was sent for a different account', 400);
  try {
    await prisma.user.update({ where: { id: userId }, data: { phone, isPhoneVerified: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new AppError('This number is used by another account', 409);
    throw err;
  }
  return phone;
}

/** Members can drop their number only if they can still sign in another way. */
export async function removePhone(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, googleId: true } });
  if (!user.email && !user.googleId) throw new AppError('Add an email first — your number is your only way to log in', 409);
  await prisma.user.update({ where: { id: userId }, data: { phone: null, isPhoneVerified: false } });
}

export async function sendChangeEmailOtp(userId: string, rawEmail: string) {
  const email = rawEmail.trim();
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (owner?.id === userId) throw new AppError('This is already your email', 409);
  if (owner) throw new AppError('This email is used by another account', 409, { code: 'EMAIL_TAKEN' });
  const code = await issueContactOtp('change-email', email, { userId });
  // Waits for delivery so a typo'd or bouncing address is reported right away.
  try {
    await sendMail(email, 'Confirm your email', `<p>Your King's Fitness code is <b>${code}</b>. It expires in 10 minutes.</p><p>If you didn't ask to add this email, ignore this message.</p>`);
  } catch {
    throw new AppError("Couldn't send the email. Check the address and try again.", 502);
  }
  return { email, cooldownSeconds: CONTACT_OTP_COOLDOWN_SECONDS };
}

export async function verifyChangeEmail(userId: string, rawEmail: string, code: string) {
  const email = rawEmail.trim();
  const data = await consumeContactOtp('change-email', email, code);
  if (data.userId !== userId) throw new AppError('This code was sent for a different account', 400);
  try {
    await prisma.user.update({ where: { id: userId }, data: { email, isEmailVerified: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new AppError('This email is used by another account', 409);
    throw err;
  }
  return email;
}

// ---------------------------------------------------------------------------
// Password-free login: a one-time code to the account's email or mobile number
// ---------------------------------------------------------------------------

async function findByIdentifier(raw: string) {
  const id = parseIdentifier(raw);
  const user =
    id.kind === 'email'
      ? await prisma.user.findFirst({ where: { email: id.value, deletedAt: null } })
      : await prisma.user.findFirst({ where: { phone: id.value, deletedAt: null } });
  return { id, user };
}

export async function sendLoginOtp(raw: string) {
  const { id, user } = await findByIdentifier(raw);
  if (!user) throw new AppError('No user found with this account.', 404, { code: 'USER_NOT_FOUND' });
  if (user.accountStatus !== 'ACTIVE') throw new AppError(`Account is ${user.accountStatus.toLowerCase()}`, 403);
  if (id.kind === 'phone' && !isPhoneAuthAvailable) throw new AppError('SMS codes are not available yet — use your password or email', 503);

  const code = await issueContactOtp('otp-login', id.value);
  if (id.kind === 'phone') await sendOtpSms(id.value, code);
  else {
    try {
      await sendMail(id.value, 'Your login code', `<p>Your King's Fitness login code is <b>${code}</b>. It expires in 10 minutes.</p><p>If you didn't try to log in, you can ignore this email.</p>`);
    } catch {
      throw new AppError("Couldn't send the email right now. Try again in a minute.", 502);
    }
  }
  return { channel: id.kind === 'phone' ? 'sms' : 'email', sentTo: id.kind === 'phone' ? maskPhone(id.value) : maskEmail(id.value), cooldownSeconds: CONTACT_OTP_COOLDOWN_SECONDS };
}

export async function verifyLoginOtp(raw: string, code: string) {
  const id = parseIdentifier(raw);
  await consumeContactOtp('otp-login', id.value, code);
  let { user } = await findByIdentifier(raw);
  if (!user) throw new AppError('No user found with this account.', 404, { code: 'USER_NOT_FOUND' });
  if (user.accountStatus !== 'ACTIVE') throw new AppError(`Account is ${user.accountStatus.toLowerCase()}`, 403);
  // Receiving the code proves the email / number belongs to them.
  const proof = id.kind === 'email' ? (!user.isEmailVerified ? { isEmailVerified: true } : null) : !user.isPhoneVerified ? { isPhoneVerified: true } : null;
  if (proof) user = await prisma.user.update({ where: { id: user.id }, data: proof });
  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
}
