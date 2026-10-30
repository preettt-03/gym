"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active ? "border-gold bg-gold font-semibold text-accent-foreground" : "border-border bg-surface-2 text-muted hover:border-gold/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const DRAG_THRESHOLD = 5;

/**
 * Horizontal chip strip. Arrows appear only on the side that has more chips
 * to reveal; it also scrolls by touch swipe, trackpad and mouse drag.
 */
export function ChipSlider({ label, children }: { label: string; children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    // Only re-render when an arrow actually appears or disappears.
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Chips can change width (fonts loading) or be added (categories arriving).
    const watchChips = () => Array.from(el.children).forEach((c) => observer.observe(c));
    watchChips();
    const mutations = new MutationObserver(() => {
      watchChips();
      measure();
    });
    mutations.observe(el, { childList: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [measure]);

  const nudge = (direction: 1 | -1) => {
    const el = trackRef.current;
    el?.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className="relative min-w-0 flex-1">
      {edges.left && (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label={`Scroll ${label.toLowerCase()} left`}
          className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg shadow-elevation hover:border-gold/50 hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div
        ref={trackRef}
        role="group"
        aria-label={label}
        onScroll={measure}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return; // touch already scrolls natively
          drag.current = { x: e.clientX, scroll: trackRef.current!.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
          if (!d.moved) trackRef.current!.setPointerCapture(e.pointerId);
          d.moved = true;
          trackRef.current!.scrollLeft = d.scroll - dx;
        }}
        onPointerUp={() => {
          // Leave `moved` set until the click that follows a drag has been swallowed.
          setTimeout(() => (drag.current = null), 0);
        }}
        onPointerCancel={() => (drag.current = null)}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={cn(
          "no-scrollbar flex select-none gap-2 overflow-x-auto scroll-smooth py-0.5",
          edges.left && "[mask-image:linear-gradient(to_right,transparent,black_48px)]",
          edges.right && "[mask-image:linear-gradient(to_left,transparent,black_48px)]",
          edges.left && edges.right && "[mask-image:linear-gradient(to_right,transparent,black_48px,black_calc(100%-48px),transparent)]"
        )}
      >
        {children}
      </div>
      {edges.right && (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label={`Scroll ${label.toLowerCase()} right`}
          className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg shadow-elevation hover:border-gold/50 hover:text-gold"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** "Level" button opening a checkbox menu; any number of levels can be on. */
export function MultiSelectMenu<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : options.map((o) => o.value).filter((o) => o === v || value.includes(o)));

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors",
          value.length || open ? "border-gold/60 bg-gold/10 text-gold" : "border-border bg-surface-2 text-muted hover:border-gold/40 hover:text-foreground"
        )}
      >
        <span className="truncate">{label}</span>
        {value.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-accent-foreground">{value.length}</span>}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div id={menuId} className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-elevation">
          <fieldset>
            <legend className="sr-only">{label}</legend>
            {options.map((o) => {
              const checked = value.includes(o.value);
              return (
                <label key={o.value} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-gold/10">
                  <span className="relative flex h-4.5 w-4.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.value)}
                      style={{ outline: "none" }}
                      className="peer h-full w-full cursor-pointer appearance-none rounded border border-muted/60 transition-colors checked:border-gold checked:bg-gold focus-visible:ring-2 focus-visible:ring-gold/40"
                    />
                    <Check aria-hidden className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-accent-foreground peer-checked:block" strokeWidth={3} />
                  </span>
                  <span className={checked ? "text-foreground" : "text-muted"}>{o.label}</span>
                </label>
              );
            })}
          </fieldset>
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-lg border-t border-border px-2.5 py-2 text-left text-xs font-semibold text-gold hover:bg-gold/10">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
