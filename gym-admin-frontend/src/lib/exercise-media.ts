import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "@/lib/api";

export const MAX_PHOTOS = 20;
export const MAX_VIDEOS = 10;

let seq = 0;
/** Stable React key for a media row that has no server id yet. */
export const newKey = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export function checkImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: use a JPG, PNG or WebP image.`;
  if (file.size > IMAGE_MAX_BYTES) return `${file.name} is over 5 MB.`;
  return null;
}
