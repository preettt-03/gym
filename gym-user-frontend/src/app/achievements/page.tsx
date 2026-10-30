"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Award, CheckCircle2, Coins, Flame, Loader2, Sparkles, Target, Trophy } from "lucide-react";
import { getMyStreak, listActiveMissions, listMyBadges, reportMissionProgress, type Mission } from "@/lib/gamification-api";
import { getMyProfile } from "@/lib/profile-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, MemberHeader, MemberPage, Meter, Panel, Tile } from "@/components/member/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

// How each mission type is measured, plus sensible one-tap increments.
const UNITS: Record<string, { unit: string; quick: number[] }> = {
  COMPLETE_WORKOUT: { unit: "workouts", quick: [1] },
  DRINK_WATER: { unit: "glasses", quick: [1, 2] },
  BURN_CALORIES: { unit: "kcal", quick: [100, 250] },
  HIT_PROTEIN_GOAL: { unit: "g protein", quick: [10, 25] },
  WALK_STEPS: { unit: "steps", quick: [1000, 5000] },
  CUSTOM: { unit: "", quick: [1] },
};

const fmt = new Intl.NumberFormat("en-IN");

function MissionCard({ mission, now }: { mission: Mission; now: number }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const meta = UNITS[mission.conditionType] ?? UNITS.CUSTOM;
  const done = mission.progress.isCompleted;
  const daysLeft = Math.max(0, Math.ceil((new Date(mission.endDate).getTime() - now) / DAY_MS));

  const add = useMutation({
    mutationFn: (v: number) => reportMissionProgress(mission.id, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      setValue("");
    },
  });
  const typed = Number(value);
  const valid = value !== "" && Number.isFinite(typed) && typed > 0 && typed <= 100_000;

  return (
    <article className={cn("glass-card flex flex-col gap-4 p-5", done && "border-success/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold uppercase leading-tight">{mission.title}</h3>
          {mission.description && <p className="mt-1 text-sm text-muted">{mission.description}</p>}
        </div>
        {done ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Done
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-muted">{daysLeft === 0 ? "Ends today" : `${daysLeft}d left`}</span>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="font-semibold tabular-nums">
            {fmt.format(mission.progress.currentValue)} / {fmt.format(mission.targetValue)} {meta.unit}
          </span>
          <span className="text-xs text-muted">
            +{mission.rewardCoins} coins · +{mission.rewardXp} XP
          </span>
        </div>
        <Meter value={Math.min(mission.progress.currentValue, mission.targetValue)} max={mission.targetValue} label={`${mission.title} progress`} />
      </div>

      {!done && (
        <form
          noValidate
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) add.mutate(typed);
          }}
        >
          {meta.quick.map((q) => (
            <Button key={q} type="button" variant="glass" size="sm" disabled={add.isPending} onClick={() => add.mutate(q)}>
              +{fmt.format(q)}
            </Button>
          ))}
          <label htmlFor={`mission-${mission.id}`} className="sr-only">
            Amount to add for {mission.title}
          </label>
          <Input
            id={`mission-${mission.id}`}
            inputMode="decimal"
            placeholder="Custom"
            className="h-9 w-24 px-3"
            value={value}
            aria-invalid={value !== "" && !valid ? true : undefined}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={!valid || add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </form>
      )}
      {add.isError && (
        <p role="alert" className="text-xs text-danger">
          {isAxiosError(add.error) ? add.error.response?.data?.error?.message ?? "Couldn't save progress" : "Couldn't save progress"}
        </p>
      )}
    </article>
  );
}

function AchievementsContent() {
  const [now] = useState(() => Date.now());
  const streak = useQuery({ queryKey: ["streak"], queryFn: getMyStreak });
  const missions = useQuery({ queryKey: ["missions"], queryFn: listActiveMissions });
  const badges = useQuery({ queryKey: ["badges"], queryFn: listMyBadges });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  const open = missions.data?.filter((m) => !m.progress.isCompleted) ?? [];
  const finished = missions.data?.filter((m) => m.progress.isCompleted) ?? [];

  return (
    <MemberPage>
      <MemberHeader
        eyebrow="Rewards"
        title="Achievements"
        description="Keep your streak alive, complete missions and collect badges."
        actions={
          <>
            <Link href="/leaderboard/hall-of-fame" className={buttonVariants({ variant: "glass", size: "sm" })}>
              Hall of Fame
            </Link>
            <Link href="/rewards" className={buttonVariants({ size: "sm" })}>
              Spend coins
            </Link>
          </>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={Flame} label="Current streak" value={`${streak.data?.currentStreak ?? 0} days`} sub={`Best: ${streak.data?.longestStreak ?? 0} days`} />
        <Tile icon={Award} label="Badges" value={String(badges.data?.length ?? 0)} />
        <Tile icon={Coins} label="Coins" value={fmt.format(profile.data?.coins ?? 0)} />
        <Tile icon={Sparkles} label="XP" value={fmt.format(profile.data?.xp ?? 0)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel icon={Target} title="Active missions">
          {missions.isPending && <Skeleton className="h-48 rounded-xl" />}
          {missions.data?.length === 0 && <EmptyState icon={Target} title="No missions right now" description="New challenges appear here when the gym launches them." />}
          {missions.data && missions.data.length > 0 && (
            <div className="flex flex-col gap-4">
              {open.map((m) => (
                <MissionCard key={m.id} mission={m} now={now} />
              ))}
              {finished.length > 0 && (
                <details className="rounded-xl border border-border p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Completed ({finished.length})
                  </summary>
                  <div className="mt-4 flex flex-col gap-4">
                    {finished.map((m) => (
                      <MissionCard key={m.id} mission={m} now={now} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </Panel>

        <Panel icon={Trophy} title="Badges">
          {badges.isPending && <Skeleton className="h-40 rounded-xl" />}
          {badges.data?.length === 0 && <EmptyState icon={Award} title="No badges yet" description="Complete missions to earn your first badge." />}
          {badges.data && badges.data.length > 0 && (
            <ul className="grid grid-cols-2 gap-3">
              {badges.data.map((b) => (
                <li key={b.id} className="flex flex-col items-center rounded-xl bg-surface-2 p-4 text-center">
                  {b.badge.iconUrl ? (
                    // Badge icons are admin uploads served from the API host.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.badge.iconUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15">
                      <Award className="h-6 w-6 text-gold" />
                    </span>
                  )}
                  <p className="mt-2 text-sm font-semibold">{b.badge.name}</p>
                  {b.badge.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{b.badge.description}</p>}
                  <p className="mt-1 text-[11px] text-muted">{date.format(new Date(b.awardedAt))}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </MemberPage>
  );
}

export default function AchievementsPage() {
  return (
    <RequireAuth>
      <AchievementsContent />
    </RequireAuth>
  );
}
