"use client";

import { isAxiosError } from "axios";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Pieces shared by the AI workout and diet generators.

export function ChoiceChips({
  label,
  options,
  value,
  onChange,
  multiple = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(multiple ? (active ? value.filter((v) => v !== o.value) : [...value, o.value]) : active ? [] : [o.value])
              }
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active ? "border-gold bg-gold text-accent-foreground" : "border-border text-muted hover:border-gold/40 hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// Friendly copy for the AI endpoints' failure modes.
export function aiErrorMessage(err: unknown) {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message as string | undefined;
    if (status === 503) return "AI features aren't set up yet. Ask the gym to enable them.";
    if (status === 429) return "The AI is busy right now. Wait a minute and try again.";
    if (status === 403) return message ?? "This AI feature is turned off by the gym.";
    if (message) return message;
  }
  return "Something went wrong while talking to the AI. Please try again.";
}

export function AiThinking({ label }: { label: string }) {
  return (
    <div role="status" className="glass-card flex flex-col items-center gap-4 p-10 text-center">
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
        <Sparkles className="h-6 w-6 animate-pulse text-gold" />
      </span>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm text-muted">This usually takes 10–20 seconds.</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <span className="skeleton h-3 rounded-full" />
        <span className="skeleton h-3 w-4/5 rounded-full" />
        <span className="skeleton h-3 w-3/5 rounded-full" />
      </div>
    </div>
  );
}
