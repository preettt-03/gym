import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Dumbbell,
  IndianRupee,
  UserPlus,
  Users,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { getAdminDashboard, getDashboardAnalytics, type AnalyticsRange } from "@/lib/api";
import { AreaChart, ColumnChart, DataTable, Donut, type DonutSegment } from "@/components/charts";
import { formatCompact } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RANGES: { days: AnalyticsRange; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

// Status colors are reserved for state and always ship with an icon + label.
const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  neutral: "#6b6b6b",
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-IN");
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const formatRupeesCompact = (n: number) => `₹${formatCompact(n)}`;

function Delta({ current, previous, days }: { current: number; previous: number; days: number }) {
  if (previous === 0) {
    return <span className="text-xs text-muted">{current > 0 ? `New vs previous ${days} days` : `No change vs previous ${days} days`}</span>;
  }
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className={cn("flex items-center font-semibold", up ? "text-success" : "text-danger")}>
        <Icon className="h-3.5 w-3.5" />
        {Math.abs(change).toFixed(0)}%
      </span>
      <span className="text-muted">vs previous {days} days</span>
    </span>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass-card flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10">
          <Icon className="h-4 w-4 text-gold" />
        </span>
      </div>
      <div className="text-2xl font-semibold tracking-tight sm:text-3xl">{value}</div>
      {children}
    </div>
  );
}

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card min-w-0 p-5", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

function DashboardSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [days, setDays] = useState<AnalyticsRange>(30);
  const kpis = useQuery({ queryKey: ["admin-dashboard"], queryFn: getAdminDashboard });
  const analytics = useQuery({
    queryKey: ["admin-dashboard-analytics", days],
    queryFn: () => getDashboardAnalytics(days),
    // Keep the previous range on screen (dimmed) while the new one loads.
    placeholderData: keepPreviousData,
  });
  const a = analytics.data;
  const k = kpis.data;

  const statusSegments: DonutSegment[] = a
    ? [
        { key: "active", label: "Active", value: a.membershipStatus.active, color: STATUS.good, icon: CheckCircle2 },
        {
          key: "expiring",
          label: `Expiring in ${a.membershipStatus.expiringWindowDays} days`,
          value: a.membershipStatus.expiringSoon,
          color: STATUS.warning,
          icon: Clock,
        },
        { key: "expired", label: "Expired", value: a.membershipStatus.expired, color: STATUS.critical, icon: AlertTriangle },
        { key: "cancelled", label: "Cancelled", value: a.membershipStatus.cancelled, color: STATUS.neutral, icon: XCircle },
      ]
    : [];
  const maxPlanCount = Math.max(1, ...(a?.activeByPlan.map((p) => p.count) ?? [1]));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-2 text-3xl font-bold uppercase">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {a ? `${shortDate.format(new Date(a.range.from))} – ${shortDate.format(new Date(a.range.to))} · India time` : "Gym performance at a glance."}
          </p>
        </div>
        <div role="group" aria-label="Date range" className="inline-flex rounded-xl border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              aria-pressed={days === r.days}
              onClick={() => setDays(r.days)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                days === r.days ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {analytics.isError && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load analytics. Check that the backend is running, then refresh.
        </p>
      )}
      {analytics.isPending && <DashboardSkeleton />}

      {a && (
        <div className={cn("mt-6 flex flex-col gap-4 transition-opacity", analytics.isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile icon={IndianRupee} label="Revenue" value={inr.format(a.totals.revenue.current)}>
              <Delta {...a.totals.revenue} days={days} />
            </StatTile>
            <StatTile icon={UserPlus} label="New members" value={count.format(a.totals.signups.current)}>
              <Delta {...a.totals.signups} days={days} />
            </StatTile>
            <StatTile icon={CalendarCheck} label="Check-ins" value={count.format(a.totals.attendance.current)}>
              <Delta {...a.totals.attendance} days={days} />
            </StatTile>
            <StatTile
              icon={CreditCard}
              label="Active memberships"
              value={count.format(a.membershipStatus.active + a.membershipStatus.expiringSoon)}
            >
              <span className="text-xs text-muted">
                {a.membershipStatus.expiringSoon} expiring in the next {a.membershipStatus.expiringWindowDays} days
              </span>
            </StatTile>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel title="Revenue" subtitle="Completed payments per day" className="xl:col-span-2">
              <AreaChart data={a.trends.revenue} label="Revenue" format={formatRupeesCompact} />
              <DataTable data={a.trends.revenue} valueLabel="Revenue" format={(n) => inr.format(n)} />
            </Panel>
            <Panel title="Membership status" subtitle="All memberships right now">
              <Donut segments={statusSegments} centerLabel="memberships" />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="Check-ins" subtitle="Gym visits per day">
              <ColumnChart data={a.trends.attendance} label="Check-ins" format={formatCompact} />
              <DataTable data={a.trends.attendance} valueLabel="Check-ins" format={(n) => count.format(n)} />
            </Panel>
            <Panel title="New members" subtitle="Sign-ups per day">
              <AreaChart data={a.trends.signups} label="New members" format={formatCompact} integer />
              <DataTable data={a.trends.signups} valueLabel="Sign-ups" format={(n) => count.format(n)} />
            </Panel>
            <Panel title="Active members by plan" subtitle="Current, non-expired memberships" className="lg:col-span-2 xl:col-span-1">
              {a.activeByPlan.length === 0 ? (
                <EmptyNote>No active memberships yet.</EmptyNote>
              ) : (
                <ul className="flex flex-col gap-4">
                  {a.activeByPlan.map((p) => (
                    <li key={p.planId}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{p.name}</span>
                        <span className="font-semibold tabular-nums">{p.count}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-surface-2">
                        <div className="h-2 rounded-full bg-gold" style={{ width: `${(p.count / maxPlanCount) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Expiring soon" subtitle={`Memberships ending in the next ${a.membershipStatus.expiringWindowDays} days`}>
              {a.expiringSoon.length === 0 ? (
                <EmptyNote>No memberships are about to expire.</EmptyNote>
              ) : (
                <ul className="divide-y divide-border">
                  {a.expiringSoon.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link to={`/users?search=${encodeURIComponent(m.user.email)}`} className="block truncate text-sm font-medium hover:text-gold">
                          {m.user.name || m.user.email}
                        </Link>
                        <p className="truncate text-xs text-muted">{m.plan.name}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#fab219]/10 px-2.5 py-1 text-xs text-foreground">
                        <Clock className="h-3.5 w-3.5 text-[#fab219]" />
                        {shortDate.format(new Date(m.endDate))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Recent payments" subtitle="Latest completed transactions">
              {a.recentPayments.length === 0 ? (
                <EmptyNote>No payments yet.</EmptyNote>
              ) : (
                <ul className="divide-y divide-border">
                  {a.recentPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.user.name || p.user.email}</p>
                        <p className="truncate text-xs text-muted">
                          {p.plan.name} · {shortDate.format(new Date(p.createdAt))}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{inr.format(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      {k && (
        <section aria-label="Platform totals" className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { icon: Users, label: "Total users", value: count.format(k.totalUsers) },
            { icon: Dumbbell, label: "Exercises", value: count.format(k.totalExercises) },
            { icon: ClipboardList, label: "Workout plans", value: count.format(k.totalWorkoutPlans) },
            { icon: UtensilsCrossed, label: "Diet plans", value: count.format(k.totalDietPlans) },
            { icon: IndianRupee, label: "Total revenue", value: inr.format(k.totalRevenue) },
          ].map((t) => (
            <div key={t.label} className="glass-card flex items-center gap-3 p-4">
              <t.icon className="h-4 w-4 shrink-0 text-gold" />
              <div className="min-w-0">
                <div className="truncate text-xs text-muted">{t.label}</div>
                <div className="truncate text-lg font-semibold">{t.value}</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
