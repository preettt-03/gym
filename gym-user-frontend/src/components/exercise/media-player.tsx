"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Play } from "lucide-react";
import { embedUrl, youtubeThumbnail } from "@/lib/video";
import { cn } from "@/lib/utils";

type Item = { kind: "video"; src: string; poster?: string } | { kind: "image"; src: string };

// Main stage (video or the selected photo) with a scrollable strip of
// everything below it. A YouTube/Vimeo link plays in its own embed; an
// uploaded file plays in a native <video>.
export function MediaPlayer({ name, videoUrl, thumbnailUrl, images }: { name: string; videoUrl: string | null; thumbnailUrl: string | null; images: string[] }) {
  const photos = [...new Set([thumbnailUrl, ...images].filter((u): u is string => Boolean(u)))];
  const items: Item[] = [
    ...(videoUrl ? [{ kind: "video" as const, src: videoUrl, poster: youtubeThumbnail(videoUrl) ?? thumbnailUrl ?? undefined }] : []),
    ...photos.map((src) => ({ kind: "image" as const, src })),
  ];
  const [index, setIndex] = useState(0);

  if (items.length === 0) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-linear-to-br from-surface-2 via-surface to-background">
        <Dumbbell className="h-12 w-12 text-gold/40" />
        <p className="text-sm text-muted">Demo video and photos coming soon.</p>
      </div>
    );
  }

  const current = items[Math.min(index, items.length - 1)];
  const go = (step: number) => setIndex((i) => (i + step + items.length) % items.length);
  const embed = current.kind === "video" ? embedUrl(current.src) : null;
  const imageNumber = (i: number) => i - (videoUrl ? 1 : 0) + 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="group relative aspect-video overflow-hidden rounded-2xl border border-border bg-black">
        {current.kind === "video" ? (
          embed ? (
            <iframe
              key={embed}
              src={embed}
              title={`${name} demonstration video`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <video key={current.src} src={current.src} poster={current.poster} controls playsInline preload="metadata" className="h-full w-full object-contain">
              Your browser can&apos;t play this video.
            </video>
          )
        ) : (
          // Exercise media is admin-uploaded and served from the API host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.src} alt={`${name} — photo ${imageNumber(index)} of ${photos.length}`} className="h-full w-full object-cover" />
        )}

        {items.length > 1 && current.kind === "image" && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div>
          <div className="flex gap-2 overflow-x-auto scroll-smooth pb-1" role="group" aria-label="Media">
            {items.map((item, i) => {
              const thumb = item.kind === "video" ? item.poster : item.src;
              return (
                <button
                  key={`${item.kind}-${item.src}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={item.kind === "video" ? "Show video" : `Show photo ${imageNumber(i)}`}
                  aria-current={i === index ? "true" : undefined}
                  className={cn(
                    "relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:w-32",
                    i === index ? "border-gold" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="block h-full w-full bg-surface-2" />
                  )}
                  {item.kind === "video" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
