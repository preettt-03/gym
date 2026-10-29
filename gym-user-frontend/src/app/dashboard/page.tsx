"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CreditCard,
  Droplets,
  Dumbbell,
  Flame,
  QrCode,
  Sparkles,
  Target,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import { getDashboard } from "@/lib/api";
import { getMotivationMessage, getNutritionSuggestion } from "@/lib/ai-api";
import { getDailyNutrition } from "@/lib/diet-api";
import { getMyMembership } from "@/lib/membership-api";
import { RequireAuth } from "@/components/require-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { cn, humanize } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const longDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className="h-2 rounded-full bg-surface-2">
      <div className={cn("h-2 rounded-full transition-all", value > max ? "bg-[#fab219]" : "bg-gold")} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Target; label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10">
          <Icon className="h-4 w-4 text-gold" />
        </span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Panel({ icon: Icon, title, action, children, className }: {
  icon: typeof Target;
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass-card flex flex-col p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold uppercase">
          <Icon className="h-5 w-5 text-gold" /> {title}
        </h2>
        {action && (
          <Link href={action.href} className="flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gold hover:underline">
            {action.label} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

function MembershipBadge() {
  const { data } = useQuery({ queryKey: ["my-membership"], queryFn: getMyMembership });
  // Read the clock once per mount so renders stay pure.
  const [now] = useState(() => Date.now());
  if (!data) return null;
  const m = data.membership;
  const daysLeft = m ? Math.ceil((new Date(m.endDate).getTime() - now) / DAY_MS) : 0;

  if (!data.isActive || !m) {
    return (
      <Link href="/membership" className="flex items-center gap-2 rounded-full border border-[#fab219]/40 bg-[#fab219]/10 px-4 py-2 text-sm text-[#fab219] hover:border-[#fab219]">
        <CreditCard className="h-4 w-4" /> {data.hasMembership ? "Membership expired — renew" : "No membership yet — view plans"}
      </Link>
    );
  }
  return (
    <Link
      href="/membership"
      className={cn(
        "flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
        daysLeft <= 7 ? "border-[#fab219]/40 bg-[#fab219]/10 text-[#fab219]" : "border-border text-muted hover:text-foreground"
      )}
    >
      <CreditCard className="h-4 w-4" />
      {m.plan.name} · {daysLeft <= 7 ? `ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : `until ${shortDate.format(new Date(m.endDate))}`}
    </Link>
  );
}

function AiCoachPanel() {
  const motivation = useQuery({ queryKey: ["ai-motivation"], queryFn: getMotivationMessage, retry: false });
  const nutrition = useQuery({ queryKey: ["ai-nutrition-suggestion"], queryFn: getNutritionSuggestion, retry: false });
  if (motivation.isError && nutrition.isError) return null;
  const loading = motivation.isPending && nutrition.isPending;

  return (
    <Panel icon={Sparkles} title="Coach's corner" action={{ href: "/ai-coach", label: "Ask AI coach" }} className="lg:col-span-3">
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {motivation.data && <p className="leading-relaxed text-foreground/85">{motivation.data.message}</p>}
          {nutrition.data?.suggestion && (
            <p className={cn("leading-relaxed text-foreground/85", motivation.data && "md:border-l md:border-border md:pl-4")}>
              {nutrition.data.suggestion}
            </p>
          )}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">AI suggestions are general guidance, not medical advice.</p>
    </Panel>
  );
}

const QUICK_ACTIONS = [
  { href: "/nutrition", label: "Log a meal", icon: UtensilsCrossed },
  { href: "/workout-plans", label: "Workouts", icon: Dumbbell },
  { href: "/attendance", label: "Check in", icon: QrCode },
  { href: "/ai-coach", label: "AI coach", icon: Bot },
];

function DashboardContent() {
  const user = useAuthStore((s) => s.user);
  const { data, isPending, isError } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const nutrition = useQuery({ queryKey: ["daily-nutrition"], queryFn: () => getDailyNutrition() });

  const eaten = nutrition.data?.totals.calories ?? 0;
  const needs = data?.metrics.calorieNeeds ?? 0;
  const weight = data?.profile.currentWeightKg;
  const target = data?.profile.targetWeightKg;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{longDate.format(new Date())}</p>
          <h1 className="mt-3 text-4xl font-bold uppercase">Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-muted">Here&apos;s where you stand today.</p>
        </div>
        <MembershipBadge />
      </div>

      <nav aria-label="Quick actions" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="glass-card card-hover flex items-center gap-3 p-4 text-sm font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10">
              <a.icon className="h-4 w-4 text-gold" />
            </span>
            {a.label}
          </Link>
        ))}
      </nav>

      {isPending && (
        <div className="mt-6 flex flex-col gap-4" aria-label="Loading dashboard">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      )}
      {isError && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load your dashboard. Please refresh in a moment.
        </p>
      )}

      {data && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile
              icon={Target}
              label="BMI"
              value={data.metrics.bmi?.toString() ?? "—"}
              sub={data.metrics.bmiCategory ? `${humanize(data.metrics.bmiCategory)} · estimate` : "Add height & weight in settings"}
            />
            <Tile icon={Flame} label="Daily calories" value={needs ? `${Math.round(needs)} kcal` : "—"} sub="Estimated need" />
            <Tile icon={Droplets} label="Water target" value={data.metrics.waterIntakeLiters ? `${data.metrics.waterIntakeLiters} L` : "—"} />
            <Tile
              icon={Trophy}
              label="Current streak"
              value={`${data.streak.currentStreak} day${data.streak.currentStreak === 1 ? "" : "s"}`}
              sub={`Longest: ${data.streak.longestStreak}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              icon={CalendarCheck}
              title="Today's workout"
              action={data.activePlan ? { href: `/workout-plans/${data.activePlan.id}`, label: "Open plan" } : { href: "/workout-plans", label: "Find a plan" }}
              className="lg:col-span-2"
            >
              {data.today.workout ? (
                data.today.workout.day.isRestDay ? (
                  <p className="text-foreground/85">Rest day — recover well. Plan: {data.today.workout.planTitle}</p>
                ) : (
                  <>
                    <p className="font-semibold">
                      {data.today.workout.day.title || "Training day"} <span className="font-normal text-muted">· {data.today.workout.planTitle}</span>
                    </p>
                    {data.today.workout.day.exercises.length > 0 && (
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {data.today.workout.day.exercises.map((e) => (
                          <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                            <span className="truncate">{e.exercise.name}</span>
                            {(e.targetSets || e.targetReps) && (
                              <span className="shrink-0 text-xs text-muted">
                                {e.targetSets ?? "—"} × {e.targetReps ?? "—"}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )
              ) : (
                <p className="text-muted">{data.activePlan ? `${data.activePlan.title} — nothing scheduled today.` : "No workout plan yet. Pick one or generate one with AI."}</p>
              )}
            </Panel>

            <Panel icon={Trophy} title="Missions" action={{ href: "/achievements", label: "View all" }}>
              <p className="text-3xl font-semibold">
                {data.dailyMissionProgress.completed}
                <span className="text-lg text-muted"> / {data.dailyMissionProgress.total}</span>
              </p>
              <p className="mb-3 text-sm text-muted">completed today</p>
              <Meter value={data.dailyMissionProgress.completed} max={Math.max(1, data.dailyMissionProgress.total)} label="Missions completed" />
              <p className="mt-4 flex items-center gap-2 text-sm">
                <span className={cn("h-2 w-2 rounded-full", data.gymAttendanceStatus.checkedIn ? "bg-success" : "bg-muted")} />
                {data.gymAttendanceStatus.checkedIn ? "You're checked in at the gym" : "Not checked in today"}
              </p>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel icon={UtensilsCrossed} title="Today's diet" action={{ href: data.today.diet ? `/diet-plans/${data.today.diet.id}` : "/diet-plans", label: data.today.diet ? "Open plan" : "Find a plan" }}>
              {data.today.diet ? (
                <>
                  <p className="font-semibold">{data.today.diet.title}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {data.today.diet.meals.map((m) => (
                      <li key={m.id} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                        {m.title || humanize(m.mealType)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-muted">No diet plan yet. Pick one or generate one with AI.</p>
              )}
            </Panel>

            <Panel icon={Flame} title="Nutrition today" action={{ href: "/nutrition", label: "Log food" }}>
              {nutrition.isPending ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : (
                <>
                  <p className="text-3xl font-semibold">
                    {Math.round(eaten)}
                    <span className="text-lg text-muted"> {needs ? `/ ${Math.round(needs)} kcal` : "kcal"}</span>
                  </p>
                  {needs > 0 && (
                    <div className="mt-3">
                      <Meter value={eaten} max={needs} label="Calories eaten vs daily need" />
                    </div>
                  )}
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    {(
                      [
                        ["Protein", nutrition.data?.totals.protein],
                        ["Carbs", nutrition.data?.totals.carbs],
                        ["Fat", nutrition.data?.totals.fat],
                      ] as const
                    ).map(([label, grams]) => (
                      <div key={label} className="flex flex-col-reverse rounded-lg bg-surface-2 py-2">
                        <dt className="text-muted">{label}</dt>
                        <dd className="text-sm font-semibold">{Math.round(grams ?? 0)} g</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </Panel>

            <Panel icon={Target} title="Weight goal" action={{ href: "/progress", label: "Progress" }}>
              {weight && target ? (
                <>
                  <p className="text-3xl font-semibold">
                    {weight}
                    <span className="text-lg text-muted"> → {target} kg</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {Math.abs(weight - target) < 0.1 ? "You've reached your target 🎯" : `${Math.abs(+(weight - target).toFixed(1))} kg to go`}
                  </p>
                  {data.profile.fitnessGoal && <p className="mt-3 text-xs text-muted">Goal: {humanize(data.profile.fitnessGoal)}</p>}
                </>
              ) : (
                <p className="text-muted">
                  Set your current and target weight in{" "}
                  <Link href="/settings" className="font-semibold text-gold hover:underline">
                    settings
                  </Link>{" "}
                  to track progress.
                </p>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AiCoachPanel />
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
