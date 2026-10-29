import { env } from '@/config/env';

export type VideoProvider = 'upload' | 'youtube' | 'vimeo';

// Exercise videos are either files we host or YouTube/Vimeo links — never an
// arbitrary third-party URL embedded in members' pages.
export function videoProvider(url: string): VideoProvider | null {
  if (url.startsWith(`${env.PUBLIC_URL}/uploads/`)) return 'upload';
  try {
    const host = new URL(url).hostname.replace(/^(www|m)\./, '');
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') return 'youtube';
    if (host === 'vimeo.com' || host === 'player.vimeo.com') return 'vimeo';
  } catch {
    // Not a URL.
  }
  return null;
}
