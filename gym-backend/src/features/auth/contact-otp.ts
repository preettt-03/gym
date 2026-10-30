import { timingSafeEqual } from 'crypto';
import { redis } from '@/lib/redis';
import { generateOtp, hashOtp } from '@/lib/otp';
import { AppError } from '@/middlewares/errorHandler';

// One-time codes for proving a phone number or email that isn't on an account
// yet (mobile sign-up / sign-in, adding a number, changing an email). Kept in
// Redis — nothing touches the users table until the code checks out.
export type ContactPurpose = 'phone-login' | 'phone-signup' | 'add-phone' | 'change-email' | 'otp-login';

const TTL_SECONDS = 10 * 60;
export const CONTACT_OTP_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

interface Entry {
  hash: string;
  attempts: number;
  data?: Record<string, string>;
}

const key = (purpose: ContactPurpose, target: string) => `cotp:${purpose}:${target.toLowerCase()}`;
const cooldownKey = (purpose: ContactPurpose, target: string) => `cotp-cd:${purpose}:${target.toLowerCase()}`;

/** Creates a fresh code (replacing any older one) and returns it for delivery. */
export async function issueContactOtp(purpose: ContactPurpose, target: string, data?: Record<string, string>) {
  // NX: only the first request in the window wins; the rest are told to wait.
  const allowed = await redis.set(cooldownKey(purpose, target), '1', 'EX', CONTACT_OTP_COOLDOWN_SECONDS, 'NX');
  if (!allowed) {
    const wait = await redis.ttl(cooldownKey(purpose, target));
    throw new AppError(`Please wait ${wait > 0 ? wait : CONTACT_OTP_COOLDOWN_SECONDS} seconds before asking for another code`, 429, {
      code: 'OTP_COOLDOWN',
      retryAfterSeconds: wait > 0 ? wait : CONTACT_OTP_COOLDOWN_SECONDS,
    });
  }
  const code = generateOtp();
  const entry: Entry = { hash: hashOtp(code), attempts: 0, data };
  await redis.set(key(purpose, target), JSON.stringify(entry), 'EX', TTL_SECONDS);
  return code;
}

/** Checks a code; burns it after too many wrong guesses. Returns the data stored with it. */
export async function consumeContactOtp(purpose: ContactPurpose, target: string, code: string) {
  const raw = await redis.get(key(purpose, target));
  if (!raw) throw new AppError('This code has expired — ask for a new one', 400, { code: 'OTP_EXPIRED' });
  const entry = JSON.parse(raw) as Entry;

  const given = Buffer.from(hashOtp(code));
  const expected = Buffer.from(entry.hash);
  if (!/^\d{6}$/.test(code) || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      await redis.del(key(purpose, target));
      throw new AppError('Too many wrong codes. Ask for a new one.', 400, { code: 'OTP_BURNED' });
    }
    const ttl = await redis.ttl(key(purpose, target));
    await redis.set(key(purpose, target), JSON.stringify(entry), 'EX', ttl > 0 ? ttl : TTL_SECONDS);
    throw new AppError(`Wrong code. ${MAX_ATTEMPTS - entry.attempts} attempt${MAX_ATTEMPTS - entry.attempts === 1 ? '' : 's'} left.`, 400, {
      code: 'OTP_WRONG',
      attemptsLeft: MAX_ATTEMPTS - entry.attempts,
    });
  }

  // GETDEL-style: whoever deletes it first is the one who used it.
  const removed = await redis.del(key(purpose, target));
  if (!removed) throw new AppError('This code was already used', 400, { code: 'OTP_EXPIRED' });
  return entry.data ?? {};
}
