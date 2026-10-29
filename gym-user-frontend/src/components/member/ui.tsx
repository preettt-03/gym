import Link from "next/link";
import { AlertCircle, ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared building blocks for the logged-in member screens, so every page
// uses the same header, panels, tiles and states as the dashboard.

export function MemberPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-6xl px-4 py-10 sm:px-6", className)}>{children}</div>;
}

export function MemberHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold uppercase leading-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  action?: { href: string; label: string } | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const linkAction = action && typeof action === "object" && "href" in action ? (action as { href: string; label: string }) : null;
  return (
    <section className={cn("glass-card flex min-w-0 flex-col p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold uppercase">
          {Icon && <Icon className="h-5 w-5 text-gold" />} {title}
        </h2>
        {linkAction ? (
          <Link href={linkAction.href} className="flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gold hover:underline">
            {linkAction.label} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          (action as React.ReactNode)
        )}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

export function Tile({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card flex min-w-0 flex-col gap-2 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted">{label}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10">
          <Icon className="h-4 w-4 text-gold" />
        </span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className="h-2 rounded-full bg-surface-2"
    >
      <div className={cn("h-2 rounded-full transition-all", value > max ? "bg-[#fab219]" : "bg-gold")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      {Icon && <Icon className="h-9 w-9 text-gold/60" />}
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
      {children}
    </p>
  );
}

// Pill-style tab strip; pass role="tablist" semantics through the buttons.
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex max-w-full overflow-x-auto rounded-xl border border-border bg-surface p-1 sm:inline-flex">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            value === t.key ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
          )}
        >
          {t.icon && <t.icon className="h-4 w-4" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}
