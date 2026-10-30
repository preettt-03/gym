"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, Calculator, Info, Lightbulb } from "lucide-react";
import { getTool } from "@/lib/tools-api";
import { getMyProfile, type UserProfile } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABEL, TOOL_ICONS } from "@/components/tools/meta";
import { cn } from "@/lib/utils";

/**
 * Page frame for every calculator: checks the admin hasn't switched the tool
 * off, shows its title, and hands the member's profile (when signed in) to
 * the calculator so it can start pre-filled.
 */
export function ToolPage({ slug, children }: { slug: string; children: (profile: UserProfile | null) => React.ReactNode }) {
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const tool = useQuery({
    queryKey: ["tool", slug],
    queryFn: () => getTool(slug),
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 1,
  });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile, enabled: isAuthed });
  const Icon = TOOL_ICONS[slug] ?? Calculator;
  // Wait for the profile so inputs can start from it (and never jump after typing).
  const waiting = tool.isPending || (isAuthed && profile.isPending);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> All tools
      </Link>

      {tool.isError ? (
        <div role="alert" className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-medium">
            {isAxiosError(tool.error) && tool.error.response?.status === 404 ? "This tool isn't available right now." : "Could not load this tool."}
          </p>
          <Link href="/tools" className="mt-3 inline-block text-sm font-semibold text-gold hover:underline">
            Browse the other tools
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 sm:flex">
              <Icon className="h-7 w-7 text-gold" />
            </span>
            <div>
              <p className="eyebrow">{tool.data ? CATEGORY_LABEL[tool.data.category] : "Tools"}</p>
              {tool.data ? (
                <h1 className="mt-2 text-4xl font-bold uppercase leading-tight">{tool.data.title}</h1>
              ) : (
                <Skeleton className="mt-2 h-10 w-72" />
              )}
              {tool.data && <p className="mt-2 max-w-2xl text-muted">{tool.data.description}</p>}
            </div>
          </div>
          <div className="mt-8">
            {waiting ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-96 rounded-2xl" />
                <Skeleton className="h-96 rounded-2xl" />
              </div>
            ) : (
              children(profile.data ?? null)
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Workspace({ inputs, results }: { inputs: React.ReactNode; results: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      {inputs}
      <div className="flex flex-col gap-4">{results}</div>
    </div>
  );
}

export function InputsCard({ onSubmit, children, submitLabel = "Calculate" }: { onSubmit?: () => void; children: React.ReactNode; submitLabel?: string }) {
  return (
    <form
      noValidate
      className="glass-card flex h-fit flex-col gap-5 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      {children}
      {onSubmit && (
        <Button type="submit" className="uppercase tracking-wider">
          <Calculator className="h-4 w-4" /> {submitLabel}
        </Button>
      )}
    </form>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface-2 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              value === o.value ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  error,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium">
        {label}
        {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      </label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          className={unit ? "pr-14" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted">{unit}</span>}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Reads a number field; returns an error message instead when it's blank or out of range. */
export function readNumber(raw: string, label: string, min: number, max: number, unit = ""): { value?: number; error?: string } {
  const text = raw.trim();
  if (!text) return { error: `${label} is required` };
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: "Enter a number" };
  if (value < min || value > max) return { error: `${label} should be between ${min} and ${max}${unit ? ` ${unit}` : ""}` };
  return { value };
}

export function ResultHero({ label, value, unit, children }: { label: string; value: string; unit?: string; children?: React.ReactNode }) {
  return (
    <section aria-live="polite" className="glass-card relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-1 font-display text-6xl font-bold leading-none text-gold">
        <span>{value}</span>
        {unit && <span className="ml-2 text-2xl text-gold/70">{unit}</span>}
      </p>
      {children}
    </section>
  );
}

export function EmptyResult({ text = "Fill in the form and press Calculate." }: { text?: string }) {
  return (
    <section aria-live="polite" className="glass-card flex flex-col items-center px-6 py-14 text-center">
      <Calculator className="h-10 w-10 text-gold/50" />
      <p className="mt-3 font-medium">Your result will appear here</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </section>
  );
}

/** Row with a filled bar, used for percentage tables and zones. */
export function BarRow({ label, value, fill, highlight }: { label: React.ReactNode; value: React.ReactNode; fill: number; highlight?: boolean }) {
  return (
    <li className={cn("relative overflow-hidden rounded-lg border px-3 py-2", highlight ? "border-gold/50" : "border-border")}>
      <span className="absolute inset-y-0 left-0 bg-gold/15" style={{ width: `${Math.max(0, Math.min(100, fill))}%` }} aria-hidden />
      <span className="relative flex items-center justify-between gap-3 text-sm">
        <span className={highlight ? "font-semibold text-gold" : "text-foreground/85"}>{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </span>
    </li>
  );
}

export function Guide({ title = "How to use this number", tips }: { title?: string; tips: React.ReactNode[] }) {
  return (
    <section className="glass-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold uppercase">
        <Lightbulb className="h-5 w-5 text-gold" /> {title}
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5 text-sm text-foreground/85">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-xs leading-relaxed text-muted">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}

// Up to `digits` decimals, without trailing zeros (101, 116.7, 2.25).
export const fmt = (n: number, digits = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });
