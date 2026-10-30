// Phone numbers are stored in E.164 (+919876543210) so the same number always
// matches, however it was typed. A bare 10-digit number is taken as Indian.
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) return `+91${digits.slice(1)}`;
  return null;
}

/** "+91 ••••• •3210" — enough to recognise the number without exposing it. */
export function maskPhone(phone: string) {
  return `${phone.slice(0, phone.length - 10)} ••••• •${phone.slice(-4)}`;
}
