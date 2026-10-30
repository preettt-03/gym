"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, Dumbbell, Flame, Scale, Search, Users } from "lucide-react";
import { listTrainees, type Trainee } from "@/lib/trainer-api";
import { RequireAuth } from "@/components/require-auth";
import { Input } from "@/components/ui/input";
import { SkeletonList } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { cn, humanize } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function daysAgo(iso: string | null) {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS) : null;
}

// Reasons a coach should check in, most urgent first.
function attentionReasons(t: Trainee) {
  const reasons: string[] = [];
  if (!t.membership) reasons.push("No active membership");
  else if (new Date(t.membership.endDate).getTime() - Date.now() < 7 * DAY_MS) reasons.push("Membership ends soon");
  const since = daysAgo(t.lastVisitAt);
  if (since === null) reasons.push("Hasn't visited yet");
  else if (since >= 7) reasons.push(`No visit in ${since} days`);
  if (t.workoutsLast7Days === 0) reasons.push("No workouts this week");
  return reasons;
}

function TraineeCard({ trainee }: { trainee: Trainee }) {
  const reasons = attentionReasons(trainee);
  const since = daysAgo(trainee.lastVisitAt);
  const weight = trainee.latestWeight?.weightKg ?? trainee.weightKg;
  return (
    <article className="glass-card card-hover relative flex h-full flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-lg text-gold">
          {(trainee.name || trainee.email || "M").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">
            <Link href={`/trainer/${trainee.id}`} className="outline-none after:absolute after:inset-0 after:rounded-[inherit]">
              {trainee.name || trainee.email || trainee.phone}
            </Link>
          </h2>
          <p className="truncate text-xs text-muted">
            {[humanize(trainee.fitnessGoal), humanize(trainee.experienceLevel)].filter(Boolean).join(" · ") || trainee.email || trainee.phone}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 shrink-0 text-gold" />
          <div>
            <dt className="sr-only">Last visit</dt>
            <dd>{since === null ? "No visits yet" : since === 0 ? "Visited today" : `Visited ${since}d ago`}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 shrink-0 text-gold" />
          <div>
            <dt className="sr-only">Workouts this week</dt>
            <dd>
              {trainee.workoutsLast7Days} workout{trainee.workoutsLast7Days === 1 ? "" : "s"} / 7d
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 shrink-0 text-gold" />
          <div>
            <dt className="sr-only">Weight</dt>
            <dd>{weight ? `${weight} → ${trainee.targetWeightKg ?? "—"} kg` : "No weigh-in"}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 shrink-0 text-gold" />
          <div>
            <dt className="sr-only">Streak</dt>
            <dd>{trainee.streak?.currentStreak ?? 0}-day streak</dd>
          </div>
        </div>
      </dl>

      <p className="text-xs text-muted">
        {trainee.membership
          ? `${trainee.membership.planName} · until ${shortDate.format(new Date(trainee.membership.endDate))}`
          : "No active membership"}
      </p>

      {reasons.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <li key={r} className="flex items-center gap-1 rounded-full bg-[#fab219]/10 px-2.5 py-1 text-xs text-[#fab219]">
              <AlertTriangle className="h-3 w-3" /> {r}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function TraineesContent() {
  const role = useAuthStore((s) => s.user?.role);
  const [search, setSearch] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const isCoach = role === "TRAINER" || role === "ADMIN";
  const { data: trainees, isPending, isError } = useQuery({ queryKey: ["trainer-trainees"], queryFn: listTrainees, enabled: isCoach });

  if (!isCoach) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center sm:py-24">
        <h1 className="text-3xl font-bold uppercase">Trainer area</h1>
        <p className="mt-3 text-muted">This section is for King&apos;s Fitness coaches. Ask an admin if you should have access.</p>
      </div>
    );
  }

  const term = search.trim().toLowerCase();
  const needAttention = trainees?.filter((t) => attentionReasons(t).length > 0).length ?? 0;
  const visible = trainees
    ?.filter((t) => !term || (t.name ?? "").toLowerCase().includes(term) || (t.email ?? "").toLowerCase().includes(term))
    .filter((t) => !onlyAttention || attentionReasons(t).length > 0)
    .sort((a, b) => attentionReasons(b).length - attentionReasons(a).length);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">Coaching</p>
      <h1 className="mt-3 flex items-center gap-3 text-4xl font-bold uppercase">
        <Users className="h-8 w-8 text-gold" /> My Trainees
      </h1>
      <p className="mt-2 text-muted">Members an admin has assigned to you. Those who need a check-in are listed first.</p>

      {trainees && trainees.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              aria-label="Search trainees"
              placeholder="Search trainees..."
              className="pl-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            aria-pressed={onlyAttention}
            onClick={() => setOnlyAttention((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              onlyAttention ? "border-gold bg-gold text-accent-foreground" : "border-border text-muted hover:text-foreground"
            )}
          >
            <AlertTriangle className="h-4 w-4" /> Needs attention ({needAttention})
          </button>
        </div>
      )}

      {isPending && <SkeletonList rows={3} className="mt-8" />}
      {isError && (
        <p role="alert" className="mt-8 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load your trainees. Please try again.
        </p>
      )}
      {trainees?.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-14 text-center text-muted">
          No trainees assigned to you yet. An admin can assign members from the admin panel.
        </div>
      )}
      {visible && trainees && trainees.length > 0 && visible.length === 0 && (
        <p className="mt-8 text-center text-muted">No trainees match.</p>
      )}

      {visible && visible.length > 0 && (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <li key={t.id}>
              <TraineeCard trainee={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TrainerTraineesPage() {
  return (
    <RequireAuth>
      <TraineesContent />
    </RequireAuth>
  );
}
