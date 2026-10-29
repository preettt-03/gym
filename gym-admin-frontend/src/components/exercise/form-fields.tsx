import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
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


// Shared drag-and-drop target; `multiple` picks several files at once.
export function DropZone({
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
