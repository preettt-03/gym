"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useDismiss } from "@/hooks/use-dismiss";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

// Browser chrome (mobile address bar) matches the page background.
const THEME_COLOR = { light: "#f6f5f1", dark: "#0a0a0a" } as const;

const noop = () => () => {};

/** True only after hydration — the stored theme is unknown on the server. */
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = THEME_COLOR[resolvedTheme === "light" ? "light" : "dark"];
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
  }, [resolvedTheme]);
  return null;
}

/** Icon button showing the current theme; opens a Light / Dark / System menu upwards. */
export function ThemeMenu({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(ref, open, () => setOpen(false));

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[1];
  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={mounted ? `Theme: ${current.label}. Change theme` : "Change theme"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
          open ? "border-gold/60 bg-gold/10 text-gold" : "border-border bg-surface-2 text-muted hover:border-gold/50 hover:text-gold"
        )}
      >
        {/* The saved theme is only known after hydration. */}
        {mounted && <CurrentIcon className="h-[18px] w-[18px]" aria-hidden />}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Color theme"
          className="absolute bottom-full right-0 z-50 mb-2 w-40 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl shadow-elevation"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                  active ? "bg-gold/10 font-semibold text-gold" : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{label}</span>
                {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
