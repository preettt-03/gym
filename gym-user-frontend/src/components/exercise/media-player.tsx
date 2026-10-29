"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Play, Video } from "lucide-react";
import type { ExerciseMedia } from "@/lib/api";
import { muscleGroupOf } from "@/lib/muscles";
import { embedUrl, youtubeThumbnail } from "@/lib/video";
import { MuscleSilhouette } from "@/components/exercise/muscle-silhouette";
import { cn } from "@/lib/utils";

type Mode = "video" | "photo";

// Videos and photos behind a [Videos (n)] [Photos (n)] switch. Several videos
// get angle chips under the player; a strip below previews everything, with
// the active item ringed in gold. No media → the target-muscle figure.
export function MediaShowcase({ name, targetMuscle, media }: { name: string; targetMuscle: string; media: ExerciseMedia[] }) {
  const videos = media.filter((m) => m.type === "VIDEO");
  const photos = media.filter((m) => m.type === "IMAGE");
  const [mode, setMode] = useState<Mode>(videos.length ? "video" : "photo");
  const [videoIndex, setVideoIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Uploaded videos only start loading once asked to play.
  const [playing, setPlaying] = useState(false);

  if (!media.length) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="relative aspect-video">
          <MuscleSilhouette group={muscleGroupOf(targetMuscle)} label={`${targetMuscle} highlighted on a body diagram`} />
          <p className="absolute inset-x-0 bottom-4 text-center text-xs uppercase tracking-[0.2em] text-muted">Demo video &amp; photos coming soon</p>
        </div>
      </div>
    );
  }

  const poster = photos[0]?.url;
  const video = videos[Math.min(videoIndex, videos.length - 1)];
  const photo = photos[Math.min(photoIndex, photos.length - 1)];
  const videoName = (v: ExerciseMedia, i: number) => v.label ?? (videos.length > 1 ? `Video ${i + 1}` : "Full execution");
  const videoThumb = (v: ExerciseMedia) => (v.provider === "youtube" ? youtubeThumbnail(v.url) : null) ?? poster;

  const showVideo = (i: number) => {
    setMode("video");
    setVideoIndex(i);
    setPlaying(true);
  };
  const showPhoto = (i: number) => {
    setMode("photo");
    setPhotoIndex(i);
  };
  const stepPhoto = (step: number) => setPhotoIndex((i) => (i + step + photos.length) % photos.length);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div role="tablist" aria-label="Media type" className="flex gap-1.5">
          {(
            [
              ["video", "Videos", videos.length, Video],
              ["photo", "Photos", photos.length, ImageIcon],
            ] as const
          ).map(([key, label, count, Icon]) =>
            count ? (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors",
                  mode === key ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label} ({count})
              </button>
            ) : null
          )}
        </div>
        <span className="truncate text-[11px] text-muted">{mode === "video" ? videoName(video, videoIndex) : photo?.label ?? `Photo ${photoIndex + 1} of ${photos.length}`}</span>
      </div>

      <div className="group relative aspect-video bg-black">
        {mode === "video" && video ? (
          playing ? (
            embedUrl(video.url) ? (
              <iframe
                key={video.id}
                src={`${embedUrl(video.url)}?autoplay=1`}
                title={`${name} — ${videoName(video, videoIndex)}`}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <video key={video.id} src={video.url} poster={poster} controls autoPlay playsInline className="h-full w-full object-contain">
                Your browser can&apos;t play this video.
              </video>
            )
          ) : (
            <button type="button" onClick={() => setPlaying(true)} className="relative block h-full w-full" aria-label={`Play ${videoName(video, videoIndex)}`}>
              {videoThumb(video) ? (
                // Exercise media is admin-uploaded and served from the API host.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={videoThumb(video)!} alt="" className="h-full w-full object-cover opacity-60" />
              ) : (
                <MuscleSilhouette group={muscleGroupOf(targetMuscle)} />
              )}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-accent-foreground shadow-[0_0_30px_rgba(229,192,123,0.45)] transition-transform group-hover:scale-110">
                  <Play className="ml-1 h-7 w-7 fill-current" />
                </span>
                <span className="rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-white">Play · {videoName(video, videoIndex)}</span>
              </span>
            </button>
          )
        ) : photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.label ?? `${name} — photo ${photoIndex + 1} of ${photos.length}`} className="h-full w-full object-cover" />
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => stepPhoto(-1)}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => stepPhoto(1)}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </>
        ) : null}
      </div>

      {mode === "video" && videos.length > 1 && (
        <div className="border-t border-border px-3 py-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Select view angle</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Video angles">
            {videos.map((v, i) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={i === videoIndex}
                onClick={() => showVideo(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                  i === videoIndex ? "border-gold/60 bg-gold/10 text-gold" : "border-border text-muted hover:border-gold/30 hover:text-foreground"
                )}
              >
                <Play className="h-3 w-3" /> {videoName(v, i)}
              </button>
            ))}
          </div>
        </div>
      )}

      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-border p-3" role="group" aria-label="All media">
          {videos.map((v, i) => {
            const thumb = videoThumb(v);
            const active = mode === "video" && i === videoIndex;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => showVideo(i)}
                aria-label={`Play ${videoName(v, i)}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:w-32",
                  active ? "gold-glow border-gold" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="carbon block h-full w-full" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <Play className="h-5 w-5 fill-white text-white" />
                </span>
              </button>
            );
          })}
          {photos.map((p, i) => {
            const active = mode === "photo" && i === photoIndex;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => showPhoto(i)}
                aria-label={`Show ${p.label ?? `photo ${i + 1}`}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "aspect-video w-28 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:w-32",
                  active ? "gold-glow border-gold" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
