"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

/** Free-text chips: Enter or comma adds one, × removes it. */
export function ChipsInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions = [],
  max = 20,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());
  const add = (raw: string) => {
    const item = raw.replace(/,$/, "").trim().slice(0, 80);
    if (item && !has(item) && value.length < max) onChange([...value, item]);
    setDraft("");
  };
  const open = suggestions.filter((s) => !has(s)).slice(0, 6);

  return (
    <div>
      <div className="glass-input flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/25">
        {value.map((item) => (
          <span key={item} className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 py-0.5 pl-2.5 pr-1 text-xs text-gold">
            {item}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== item))} className="rounded-full p-0.5 hover:bg-gold/20" aria-label={`Remove ${item}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          style={{ outline: "none" }}
          className="h-7 min-w-32 flex-1 bg-transparent px-1.5 text-sm placeholder:text-muted"
        />
      </div>
      {open.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {open.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:border-gold/40 hover:text-foreground">
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
