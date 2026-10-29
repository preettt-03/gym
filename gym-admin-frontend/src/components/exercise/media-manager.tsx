import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Film, GripVertical, ImagePlus, Link2, Loader2, RefreshCw, Star, Trash2, Upload, X } from "lucide-react";
import { IMAGE_TYPES, uploadImage, uploadVideo, VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/api";
import { apiErrorMessage } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropZone } from "@/components/exercise/form-fields";
import { checkImage, MAX_PHOTOS, MAX_VIDEOS, newKey } from "@/lib/exercise-media";
import { cn } from "@/lib/utils";

export interface PhotoItem {
  key: string;
  url: string;
  label: string;
  isThumbnail: boolean;
}

export interface VideoItem {
  key: string;
  url: string;
  label: string;
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host === "youtube.com") return u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null;
  } catch {
    // ignore
  }
  return null;
}

function providerOf(url: string): "youtube" | "vimeo" | "upload" | null {
  if (youtubeId(url)) return "youtube";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "vimeo.com" || host === "player.vimeo.com") return /\d+/.test(new URL(url).pathname) ? "vimeo" : null;
  } catch {
    return null;
  }
  return url.includes("/uploads/") ? "upload" : null;
}

const PROVIDER_LABEL = { youtube: "YouTube", vimeo: "Vimeo", upload: "Uploaded" } as const;

/** Photo grid: multi-file drop, drag-handle reordering, pick the card thumbnail, caption, replace, delete. */
export function PhotosManager({
  value,
  onChange,
  onError,
  onBusy,
}: {
  value: PhotoItem[];
  onChange: (next: PhotoItem[]) => void;
  onError: (message: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceKey = useRef<string | null>(null);
  // Uploads finish out of order; build on the latest list, not the one captured at drop time.
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => onBusy(pending > 0), [pending, onBusy]);

  const track = async <T,>(count: number, work: () => Promise<T>) => {
    setPending((n) => n + count);
    try {
      return await work();
    } finally {
      setPending((n) => n - count);
    }
  };

  const add = async (files: File[]) => {
    const room = MAX_PHOTOS - value.length - pending;
    if (files.length > room) onError(`Only ${MAX_PHOTOS} photos are allowed — the extra ones were skipped.`);
    const valid = files.slice(0, Math.max(0, room)).filter((f) => {
      const problem = checkImage(f);
      if (problem) onError(problem);
      return !problem;
    });
    if (!valid.length) return;
    const results = await track(valid.length, () => Promise.allSettled(valid.map(uploadImage)));
    const urls = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (urls.length < valid.length) onError("Some photos couldn't be uploaded — try those again.");
    const current = latest.current;
    const added = urls.map((url) => ({ key: newKey(), url, label: "", isThumbnail: false }));
    onChange([...current, ...added]);
  };

  const replace = async (file: File | undefined) => {
    const key = replaceKey.current;
    if (!file || !key) return;
    const problem = checkImage(file);
    if (problem) return onError(problem);
    try {
      const url = await track(1, () => uploadImage(file));
      onChange(latest.current.map((p) => (p.key === key ? { ...p, url } : p)));
    } catch (err) {
      onError(apiErrorMessage(err, "Couldn't replace the photo"));
    }
  };

  const set = (key: string, patch: Partial<PhotoItem>) => onChange(value.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  // Exactly one thumbnail: picking one clears the others; picking it again unsets it.
  const toggleThumbnail = (key: string) => onChange(value.map((p) => ({ ...p, isThumbnail: p.key === key ? !p.isThumbnail : false })));
  const thumbnailKey = (value.find((p) => p.isThumbnail) ?? value[0])?.key;

  return (
    <div>
      <input
        ref={replaceRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void replace(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((photo, i) => {
          const isCover = photo.key === thumbnailKey;
          return (
            <li
              key={photo.key}
              draggable
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDragOver(i);
              }}
              onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== i) onChange(move(value, dragFrom, i));
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border bg-surface-2/60 transition-all",
                isCover ? "gold-glow border-gold/60" : "border-border",
                dragOver === i && dragFrom !== i && "border-gold ring-2 ring-gold/30",
                dragFrom === i && "opacity-40"
              )}
            >
              <div className="relative aspect-[4/3]">
                <img src={photo.url} alt={photo.label || `Photo ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
                <span className="absolute left-1.5 top-1.5 flex cursor-grab items-center rounded-md bg-black/70 p-1 text-white active:cursor-grabbing" title="Drag to reorder" aria-hidden>
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => toggleThumbnail(photo.key)}
                  aria-pressed={photo.isThumbnail}
                  aria-label={photo.isThumbnail ? `Photo ${i + 1} is the card thumbnail` : `Set photo ${i + 1} as card thumbnail`}
                  title={isCover && !photo.isThumbnail ? "Used as thumbnail (first photo) — click to pin it" : "Set as card thumbnail"}
                  className={cn(
                    "absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
                    isCover ? "bg-gold text-accent-foreground" : "bg-black/70 text-white hover:bg-gold hover:text-accent-foreground"
                  )}
                >
                  <Star className={cn("h-3 w-3", isCover && "fill-current")} />
                  {isCover ? "Thumbnail" : "Set"}
                </button>
              </div>
              <div className="flex flex-col gap-1.5 p-2">
                <input
                  value={photo.label}
                  maxLength={60}
                  onChange={(e) => set(photo.key, { label: e.target.value })}
                  placeholder="Caption (optional)"
                  aria-label={`Caption for photo ${i + 1}`}
                  style={{ outline: "none" }}
                  className="h-8 w-full rounded-md border border-border bg-background/60 px-2 text-xs placeholder:text-muted focus:border-gold/60"
                />
                <div className="flex items-center justify-between">
                  <div className="flex">
                    <button type="button" disabled={i === 0} onClick={() => onChange(move(value, i, i - 1))} aria-label={`Move photo ${i + 1} earlier`} className="rounded p-1 text-muted hover:text-foreground disabled:opacity-30">
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, i + 1))} aria-label={`Move photo ${i + 1} later`} className="rounded p-1 text-muted hover:text-foreground disabled:opacity-30">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => {
                        replaceKey.current = photo.key;
                        replaceRef.current?.click();
                      }}
                      aria-label={`Replace photo ${i + 1}`}
                      className="rounded p-1 text-muted hover:text-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => onChange(value.filter((p) => p.key !== photo.key))} aria-label={`Delete photo ${i + 1}`} className="rounded p-1 text-muted hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {Array.from({ length: pending }, (_, i) => (
          <li key={`pending-${i}`} className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-gold/40 bg-gold/5" aria-label="Uploading photo">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </li>
        ))}
        {value.length + pending < MAX_PHOTOS && (
          <li>
            <DropZone id="ex-photos" accept={IMAGE_TYPES.join(",")} multiple onFiles={(f) => void add(f)} className="h-full min-h-40 w-full">
              <ImagePlus className="h-5 w-5" />
              <span className="font-medium">Add photos</span>
              <span>Drop several at once</span>
            </DropZone>
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-muted">
        {value.length}/{MAX_PHOTOS} photos · drag the <GripVertical className="inline h-3 w-3" /> handle (or use the arrows) to reorder. The
        <Star className="mx-0.5 inline h-3 w-3 fill-gold text-gold" />
        photo is the library card image — the first photo unless you pick one.
      </p>
    </div>
  );
}

type PendingVideo = { key: string; name: string; progress: number };

/** Labelled videos: several uploads (each with its own progress bar) and YouTube/Vimeo links. */
export function VideosManager({
  value,
  onChange,
  onError,
  onBusy,
}: {
  value: VideoItem[];
  onChange: (next: VideoItem[]) => void;
  onError: (message: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState<PendingVideo[]>([]);
  const [link, setLink] = useState("");
  useEffect(() => onBusy(pending.length > 0), [pending.length, onBusy]);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceKey = useRef<string | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const check = (file: File) => {
    if (!VIDEO_TYPES.includes(file.type)) return `${file.name}: use an MP4, WebM or MOV video.`;
    if (file.size > VIDEO_MAX_BYTES) return `${file.name} is over 100 MB — trim or compress it first.`;
    return null;
  };

  const runUpload = async (file: File, onDone: (url: string) => void) => {
    const key = newKey();
    setPending((p) => [...p, { key, name: file.name, progress: 0 }]);
    try {
      const url = await uploadVideo(file, (progress) => setPending((p) => p.map((v) => (v.key === key ? { ...v, progress } : v))));
      onDone(url);
    } catch (err) {
      onError(apiErrorMessage(err, `Couldn't upload ${file.name}`));
    } finally {
      setPending((p) => p.filter((v) => v.key !== key));
    }
  };

  const add = (files: File[]) => {
    const room = MAX_VIDEOS - value.length - pending.length;
    if (files.length > room) onError(`Only ${MAX_VIDEOS} videos are allowed — the extra ones were skipped.`);
    for (const file of files.slice(0, Math.max(0, room))) {
      const problem = check(file);
      if (problem) {
        onError(problem);
        continue;
      }
      // Default label from the file name ("side-angle.mp4" → "side angle").
      const label = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 60);
      void runUpload(file, (url) => onChange([...latest.current, { key: newKey(), url, label }]));
    }
  };

  const addLink = () => {
    const url = link.trim();
    if (!url) return;
    const provider = providerOf(url);
    if (provider !== "youtube" && provider !== "vimeo") return onError("Paste a full YouTube or Vimeo video link, e.g. https://youtu.be/...");
    if (value.length + pending.length >= MAX_VIDEOS) return onError(`Only ${MAX_VIDEOS} videos are allowed.`);
    onChange([...value, { key: newKey(), url, label: "" }]);
    setLink("");
  };

  const set = (key: string, patch: Partial<VideoItem>) => onChange(value.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={replaceRef}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          const key = replaceKey.current;
          e.target.value = "";
          if (!file || !key) return;
          const problem = check(file);
          if (problem) return onError(problem);
          void runUpload(file, (url) => onChange(latest.current.map((v) => (v.key === key ? { ...v, url } : v))));
        }}
      />

      {value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {value.map((video, i) => {
            const provider = providerOf(video.url) ?? "upload";
            const yt = youtubeId(video.url);
            return (
              <li key={video.key} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/60 p-3 sm:flex-row sm:items-center">
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-black sm:w-36">
                  {yt ? (
                    <img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                  ) : provider === "upload" ? (
                    <video src={video.url} muted preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <span className="carbon flex h-full w-full items-center justify-center">
                      <Film className="h-5 w-5 text-gold" />
                    </span>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">{PROVIDER_LABEL[provider]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    value={video.label}
                    maxLength={60}
                    onChange={(e) => set(video.key, { label: e.target.value })}
                    placeholder={`Label, e.g. ${["Full execution", "Side form check", "Setup guide"][i % 3]}`}
                    aria-label={`Label for video ${i + 1}`}
                    className="h-10"
                  />
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[11px] text-muted hover:text-gold">
                    {video.url}
                  </a>
                </div>
                <div className="flex shrink-0 items-center justify-end">
                  <button type="button" disabled={i === 0} onClick={() => onChange(move(value, i, i - 1))} aria-label={`Move video ${i + 1} up`} className="rounded p-1.5 text-muted hover:text-foreground disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, i + 1))} aria-label={`Move video ${i + 1} down`} className="rounded p-1.5 text-muted hover:text-foreground disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  {provider === "upload" && (
                    <button
                      type="button"
                      onClick={() => {
                        replaceKey.current = video.key;
                        replaceRef.current?.click();
                      }}
                      aria-label={`Replace video ${i + 1}`}
                      className="rounded p-1.5 text-muted hover:text-foreground"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => onChange(value.filter((v) => v.key !== video.key))} aria-label={`Delete video ${i + 1}`} className="rounded p-1.5 text-muted hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pending.map((p) => (
        <div key={p.key} className="flex items-center gap-3 rounded-xl border border-dashed border-gold/40 bg-gold/5 px-3 py-2.5" role="status">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gold" />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2 text-xs">
              <span className="truncate">{p.name}</span>
              <span className="tabular-nums text-muted">{p.progress}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${p.progress}%` }} />
            </div>
          </div>
        </div>
      ))}

      {value.length + pending.length < MAX_VIDEOS && (
        <div className="grid gap-3 md:grid-cols-2">
          <DropZone id="ex-videos" accept={VIDEO_TYPES.join(",")} multiple onFiles={add} className="py-5">
            <Upload className="h-5 w-5" />
            <span className="font-medium">Upload videos</span>
            <span>MP4, WebM or MOV · up to 100 MB each</span>
          </DropZone>
          <div className="flex flex-col justify-center gap-2 rounded-xl border border-border bg-surface-2/40 p-4">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Link2 className="h-3.5 w-3.5 text-gold" /> Add a YouTube or Vimeo link
            </span>
            <div className="flex gap-2">
              <Input
                aria-label="YouTube or Vimeo link"
                placeholder="https://youtu.be/..."
                value={link}
                className="h-10"
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
              />
              <Button type="button" variant="glass" className="h-10" onClick={addLink} disabled={!link.trim()}>
                Add
              </Button>
              {link && (
                <button type="button" onClick={() => setLink("")} aria-label="Clear link" className="text-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-muted">
        {value.length}/{MAX_VIDEOS} videos. Labels become the angle buttons under the member&apos;s player.
      </p>
    </div>
  );
}
