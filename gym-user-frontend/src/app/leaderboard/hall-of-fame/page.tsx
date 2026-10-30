"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Landmark } from "lucide-react";
import { getHallOfFame, type CyclePeriod, type HallOfFameCycle } from "@/lib/leaderboard-api";
import { useAuthStore } from "@/stores/auth-store";
import { RequireAuth } from "@/components/require-auth";
import { Avatar } from "@/components/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorNote, MemberHeader, MemberPage, SegmentedTabs } from "@/components/member/ui";
import { cn } from "@/lib/utils";

const PERIODS: { key: CyclePeriod; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "daily", label: "Daily" },
];
const TZ = "Asia/Kolkata";
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const fullDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: TZ });
const num = new Intl.NumberFormat("en-IN");

const PLACES = [
  { medal: "🥇", text: "text-gold", ring: "ring-gold" },
  { medal: "🥈", text: "text-silver", ring: "ring-silver" },
  { medal: "🥉", text: "text-bronze", ring: "ring-bronze" },
];

function cycleLabel(c: HallOfFameCycle) {
  const start = new Date(c.periodStart);
  if (c.period === "daily") return fullDate.format(start);
  if (c.period === "monthly") return monthYear.format(start);
  return `Week of ${shortDate.format(start)} – ${shortDate.format(new Date(new Date(c.periodEnd).getTime() - 1))}`;
}

function CycleCard({ cycle, myId }: { cycle: HallOfFameCycle; myId: string | undefined }) {
  const [champion] = cycle.podium;
  return (
    <li className="glass-card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-border bg-linear-to-r from-gold/15 to-transparent px-5 py-4">
        <div className="relative">
          <Crown aria-hidden className="absolute -top-3 left-1/2 h-5 w-5 -translate-x-1/2 fill-gold text-gold" />
          <Avatar photoUrl={champion.photoUrl} name={champion.name} size="md" className="ring-2 ring-gold ring-offset-2 ring-offset-surface" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">{cycleLabel(cycle)}</p>
          <p className="truncate font-display text-xl font-bold uppercase">
            {champion.name}
            {champion.userId === myId && <span className="ml-2 text-sm font-normal normal-case text-gold">(you)</span>}
          </p>
        </div>
        <p className="shrink-0 font-display text-2xl font-bold text-gold">{num.format(champion.points)}</p>
      </div>
      <ol className="divide-y divide-border">
        {cycle.podium.map((e, i) => (
          <li key={e.userId} className={cn("flex items-center gap-3 px-5 py-2.5 text-sm", e.userId === myId && "bg-gold/5")}>
            <span aria-label={`Place ${i + 1}`}>{PLACES[i].medal}</span>
            <Avatar photoUrl={e.photoUrl} name={e.name} className={cn("h-8 w-8 ring-1", PLACES[i].ring)} />
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <span className="hidden text-xs text-muted sm:inline">
              {e.workouts} workouts · {num.format(e.caloriesBurned)} kcal
            </span>
            <span className={cn("w-16 text-right font-semibold tabular-nums", PLACES[i].text)}>{num.format(e.points)}</span>
          </li>
        ))}
      </ol>
    </li>
  );
}

function HallOfFameContent() {
  const me = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState<CyclePeriod>("weekly");
  const cycles = useQuery({ queryKey: ["hall-of-fame", period], queryFn: () => getHallOfFame(period) });

  return (
    <MemberPage>
      <Link href="/leaderboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Live leaderboard
      </Link>
      <MemberHeader eyebrow="Leaderboard" title="Hall of Fame" description="Every champion, frozen the moment their week, month or day ended." />
      <div className="mt-6">
        <SegmentedTabs label="Hall of Fame period" tabs={PERIODS} value={period} onChange={setPeriod} />
      </div>

      {cycles.isPending && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      )}
      {cycles.isError && (
        <div className="mt-6">
          <ErrorNote>Could not load the Hall of Fame.</ErrorNote>
        </div>
      )}
      {cycles.data?.length === 0 && (
        <div className="mt-8">
          <EmptyState icon={Landmark} title="No champions yet" description="Winners appear here as soon as a cycle ends. Yours could be the first name on the wall." />
        </div>
      )}
      {cycles.data && cycles.data.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {cycles.data.map((c) => (
            <CycleCard key={c.id} cycle={c} myId={me?.id} />
          ))}
        </ul>
      )}
    </MemberPage>
  );
}

export default function HallOfFamePage() {
  return (
    <RequireAuth>
      <HallOfFameContent />
    </RequireAuth>
  );
}
