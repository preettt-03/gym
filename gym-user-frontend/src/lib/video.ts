// Turns a YouTube/Vimeo page link into its embeddable player URL; anything else
// is treated as a direct video file and played with <video>.
export function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.match(/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    // Not a URL at all.
  }
  return null;
}

/** Still image for a YouTube link, used for the gallery strip. */
export function youtubeThumbnail(url: string): string | null {
  const id = embedUrl(url)?.match(/youtube-nocookie\.com\/embed\/([^/?]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
