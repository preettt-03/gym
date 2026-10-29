import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Film, ImagePlus, Link2, Loader2, Plus, Upload, X } from "lucide-react";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, uploadImage, uploadVideo, VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/api";
import { apiErrorMessage } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium">
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

/** Chips with an inline input: Enter or comma adds, Backspace on an empty box removes the last. */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions = [],
  max = 10,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: readonly string[];
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const has = (tag: string) => value.some((v) => v.toLowerCase() === tag.toLowerCase());
  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "").trim();
    if (tag && !has(tag) && value.length < max) onChange([...value, tag]);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const open = suggestions.filter((s) => !has(s) && (!draft || s.toLowerCase().includes(draft.toLowerCase()))).slice(0, 8);

  return (
    <div>
      <div className="glass-input flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/25">
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 py-0.5 pl-2.5 pr-1 text-xs text-gold">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded-full p-0.5 hover:bg-gold/20"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          disabled={value.length >= max}
          placeholder={value.length ? "" : placeholder}
          style={{ outline: "none" }}
          className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-sm placeholder:text-muted"
        />
      </div>
      {open.length > 0 && value.length < max && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggestions">
          {open.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:border-gold/40 hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Numbered, reorderable rows (execution steps, common mistakes). */
export function ListEditor({
  label,
  value,
  onChange,
  placeholder,
  addLabel,
  max = 20,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  max?: number;
}) {
  const baseId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const set = (i: number, text: string) => onChange(value.map((v, j) => (j === i ? text : v)));
  const move = (i: number, to: number) => {
    const next = [...value];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };
  const add = () => {
    if (value.length >= max) return;
    onChange([...value, ""]);
    // Focus the new row once it renders.
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLInputElement>("li:last-child input")?.focus());
  };

  return (
    <div>
      <ol ref={listRef} className="flex flex-col gap-2">
        {value.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">{i + 1}</span>
            <Input
              id={`${baseId}-${i}`}
              aria-label={`${label} ${i + 1}`}
              value={item}
              placeholder={placeholder}
              maxLength={500}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (i === value.length - 1) add();
                }
              }}
            />
            <div className="flex shrink-0">
              <button type="button" className="rounded-lg p-1.5 text-muted hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${label.toLowerCase()} ${i + 1} up`}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-lg p-1.5 text-muted hover:text-foreground disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${label.toLowerCase()} ${i + 1} down`}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-lg p-1.5 text-muted hover:text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" variant="glass" size="sm" className="mt-2" onClick={add} disabled={value.length >= max}>
        <Plus className="h-4 w-4" /> {addLabel}
      </Button>
    </div>
  );
}

function checkImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: use a JPG, PNG or WebP image.`;
  if (file.size > IMAGE_MAX_BYTES) return `${file.name} is over 5 MB.`;
  return null;
}

// Shared drag-and-drop target; `multiple` picks several files at once.
function DropZone({
  id,
  accept,
  multiple,
  busy,
  onFiles,
  children,
  className,
}: {
  id: string;
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy) onFiles([...e.dataTransfer.files]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-surface-2/50 p-4 text-center text-xs text-muted transition-colors hover:border-gold/50 hover:text-foreground",
        over && "border-gold bg-gold/5 text-foreground",
        busy && "pointer-events-none opacity-70",
        className
      )}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      {children}
    </label>
  );
}

export function ThumbnailField({ value, onChange, onError }: { value: string | null; onChange: (url: string | null) => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async ([file]: File[]) => {
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return onError(problem);
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      onError(apiErrorMessage(err, "Couldn't upload the thumbnail"));
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border">
        <img src={value} alt="Thumbnail preview" className="h-full w-full object-cover" />
        <button type="button" onClick={() => onChange(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-danger" aria-label="Remove thumbnail">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <DropZone id="ex-thumbnail" accept={IMAGE_TYPES.join(",")} busy={busy} onFiles={pick} className="aspect-video">
      {busy ? <Loader2 className="h-5 w-5 animate-spin text-gold" /> : <Upload className="h-5 w-5" />}
      <span className="font-medium">{busy ? "Uploading..." : "Upload thumbnail"}</span>
      <span>16:9 works best · up to 5 MB</span>
    </DropZone>
  );
}

export function GalleryField({ value, onChange, onError, max = 12 }: { value: string[]; onChange: (urls: string[]) => void; onError: (m: string) => void; max?: number }) {
  const [uploading, setUploading] = useState(0);
  const pick = async (files: File[]) => {
    const room = max - value.length;
    const chosen = files.slice(0, room);
    if (files.length > room) onError(`Only ${max} gallery images are allowed.`);
    const valid = chosen.filter((f) => {
      const problem = checkImage(f);
      if (problem) onError(problem);
      return !problem;
    });
    if (!valid.length) return;
    setUploading(valid.length);
    const results = await Promise.allSettled(valid.map(uploadImage));
    setUploading(0);
    const urls = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (urls.length < valid.length) onError("Some images couldn't be uploaded — try those again.");
    onChange([...value, ...urls]);
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {value.map((url, i) => (
        <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
          <img src={url} alt={`Gallery image ${i + 1}`} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(value.filter((u) => u !== url))}
            className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-danger"
            aria-label={`Remove gallery image ${i + 1}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {value.length < max && (
        <DropZone id="ex-gallery" accept={IMAGE_TYPES.join(",")} multiple busy={uploading > 0} onFiles={pick} className="aspect-square">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-gold" /> : <ImagePlus className="h-5 w-5" />}
          <span>{uploading ? `Uploading ${uploading}...` : "Add images"}</span>
        </DropZone>
      )}
    </div>
  );
}

const isEmbed = (url: string) => /youtube\.com|youtu\.be|vimeo\.com/i.test(url);

export function VideoField({ value, onChange, onError }: { value: string | null; onChange: (url: string | null) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"upload" | "link">(value && isEmbed(value) ? "link" : "upload");
  const [link, setLink] = useState(value && isEmbed(value) ? value : "");
  const [progress, setProgress] = useState<number | null>(null);

  const pick = async ([file]: File[]) => {
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) return onError("Use an MP4, WebM or MOV video.");
    if (file.size > VIDEO_MAX_BYTES) return onError("That video is over 100 MB — trim or compress it first.");
    setProgress(0);
    try {
      onChange(await uploadVideo(file, setProgress));
    } catch (err) {
      onError(apiErrorMessage(err, "Couldn't upload the video"));
    } finally {
      setProgress(null);
    }
  };

  const applyLink = () => {
    const url = link.trim();
    if (!url) return onChange(null);
    try {
      new URL(url);
      onChange(url);
    } catch {
      onError("Enter a full link, e.g. https://www.youtube.com/watch?v=...");
    }
  };

  return (
    <div>
      <div role="tablist" aria-label="Video source" className="mb-2 inline-flex rounded-lg border border-border p-0.5 text-xs">
        {(
          [
            ["upload", "Upload file", Upload],
            ["link", "YouTube / Vimeo link", Link2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1", mode === key ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground")}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
          {isEmbed(value) ? (
            <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-gold/10">
              <Film className="h-5 w-5 text-gold" />
            </span>
          ) : (
            <video src={value} className="h-12 w-20 shrink-0 rounded-lg bg-black object-cover" muted preload="metadata" />
          )}
          <a href={value} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-xs text-muted hover:text-gold">
            {value}
          </a>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setLink("");
            }}
            className="rounded-lg p-1.5 text-muted hover:text-danger"
            aria-label="Remove video"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : mode === "upload" ? (
        <DropZone id="ex-video" accept={VIDEO_TYPES.join(",")} busy={progress !== null} onFiles={pick} className="py-6">
          {progress !== null ? <Loader2 className="h-5 w-5 animate-spin text-gold" /> : <Film className="h-5 w-5" />}
          <span className="font-medium">{progress !== null ? `Uploading... ${progress}%` : "Upload video (.mp4)"}</span>
          {progress !== null ? (
            <span className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-1 bg-gold transition-all" style={{ width: `${progress}%` }} />
            </span>
          ) : (
            <span>MP4, WebM or MOV · up to 100 MB</span>
          )}
        </DropZone>
      ) : (
        <div className="flex gap-2">
          <Input
            aria-label="Video link"
            placeholder="https://www.youtube.com/watch?v=..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <Button type="button" variant="glass" onClick={applyLink}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
