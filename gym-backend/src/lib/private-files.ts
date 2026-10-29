import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '@/config/env';
import { IMAGE_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/upload';

// Files that must never be publicly reachable (progress photos). Kept outside
// UPLOAD_DIR on purpose — that folder is served statically to anyone.
export const PRIVATE_UPLOAD_DIR = path.join(process.cwd(), 'private-uploads');

if (!fs.existsSync(PRIVATE_UPLOAD_DIR)) {
  fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
}

// Storage keys are always `<uuid>.<ext>`; anything else is rejected before touching the disk.
const KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
// The extension comes from the (already filtered) mimetype, never the client's filename.
const EXTENSION: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

export const privateImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRIVATE_UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${EXTENSION[file.mimetype] ?? '.jpg'}`),
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});

export const SIGNED_URL_TTL_SECONDS = 60 * 60;

// A separate key derived from the access-token secret, so a signature can never
// be confused with (or reused as) a JWT signature.
const signingKey = crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update('private-file-urls').digest();

function signature(key: string, expires: number) {
  return crypto.createHmac('sha256', signingKey).update(`${key}.${expires}`).digest('base64url');
}

/** A URL to a private file that works (e.g. in an <img>) until it expires. */
export function signedFileUrl(routeBase: string, key: string, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${env.PUBLIC_URL}${routeBase}/${key}?expires=${expires}&sig=${signature(key, expires)}`;
}

export function verifyFileSignature(key: string, expires: unknown, sig: unknown) {
  if (!KEY_PATTERN.test(key) || typeof expires !== 'string' || typeof sig !== 'string') return false;
  const exp = Number(expires);
  if (!Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(signature(key, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function privateFilePath(key: string) {
  return path.join(PRIVATE_UPLOAD_DIR, path.basename(key));
}
