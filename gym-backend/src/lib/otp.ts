import crypto from 'crypto';
import { env } from '@/config/env';

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i += 1) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
}

// OTPs are stored only as a keyed hash. A plain SHA-256 of a 6-digit code could be
// reversed by trying all million values, so the server secret (never in the DB) is
// mixed in: a leaked otp_codes table alone reveals nothing usable.
const otpKey = () => crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update('otp-codes').digest();

export function hashOtp(code: string): string {
  return crypto.createHmac('sha256', otpKey()).update(code).digest('hex');
}
