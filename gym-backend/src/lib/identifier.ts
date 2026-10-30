import { AppError } from '@/middlewares/errorHandler';
import { normalizePhone } from '@/lib/phone';

export type Identifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

/** One "Email or mobile number" box: anything with an @ is an email, otherwise a phone number. */
export function parseIdentifier(raw: string): Identifier {
  const text = raw.trim();
  if (text.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new AppError('Enter a valid email address', 422, { code: 'INVALID_IDENTIFIER' });
    return { kind: 'email', value: text };
  }
  const phone = normalizePhone(text);
  if (!phone) throw new AppError('Enter a valid email or 10-digit mobile number', 422, { code: 'INVALID_IDENTIFIER' });
  return { kind: 'phone', value: phone };
}

/** "ra•••@gmail.com" */
export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(4, local.length - 2)))}@${domain}`;
}
