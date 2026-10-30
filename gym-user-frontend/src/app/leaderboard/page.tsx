"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Dumbbell, Flame, Gift, Info, Landmark, Medal, PauseCircle, Timer, Trophy } from "lucide-react";
import { ProfileCompletionCard } from "@/components/profile-completion-card";
import { PushPrompt } from "@/components/leaderboard/push-prompt";
import {
  getLeaderboard,
  giveHighFive,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type LeaderboardResponse,
  type LeaderboardSegment,
  type LeaderboardWeights,
  type RewardTier,
} from "@/lib/leaderboard-api";
import { Chip, ChipSlider } from "@/components/exercise/library-filters";
import { useAuthStore } from "@/stores/auth-store";
import { RequireAuth } from "@/components/require-auth";
import { Avatar } from "@/components/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorNote, MemberHeader, MemberPage, SegmentedTabs } from "@/components/member/ui";
import { cn } from "@/lib/utils";

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all-time", label: "All-time" },
];
const PERIOD_NOUN: Record<LeaderboardPeriod, string> = { daily: "today", weekly: "this week", monthly: "this month", "all-time": "yet" };

// Fairer races: rank only people like you. Members set these in their profile.
const SEGMENTS: { key: LeaderboardSegment; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "beginner", label: "Beginners" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
  { key: "fat-loss", label: "Fat loss" },
  { key: "strength", label: "Strength" },
];

const TZ = "Asia/Kolkata";
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: TZ });
const fullDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const num = new Intl.NumberFormat("en-IN");

function rangeLabel(period: LeaderboardPeriod, range: { start: string; end: string }) {
  const start = new Date(range.start);
  const lastDay = new Date(new Date(range.end).getTime() - 1);
  if (period === "daily") return fullDate.format(start);
  if (period === "weekly") return `${shortDate.format(start)} – ${shortDate.format(lastDay)}`;
  if (period === "monthly") return monthYear.format(start);
  return "Since the gym opened";
}

function duration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** 👏 for another member; one per board, shown instantly while the request runs. */
function HighFiveButton({ entry, period, isMe, queryKey }: { entry: LeaderboardEntry; period: LeaderboardPeriod; isMe: boolean; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => giveHighFive(entry.userId, period),
    onMutate: () => {
      queryClient.setQueryData<LeaderboardResponse>(queryKey, (old) =>
        old?.enabled
          ? { ...old, entries: old.entries.map((e) => (e.userId === entry.userId ? { ...e, highFives: e.highFives + 1, highFivedByMe: true } : e)) }
          : old
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  const done = entry.highFivedByMe;
  return (
    <button
      type="button"
      disabled={isMe || done || mutation.isPending}
      onClick={() => mutation.mutate()}
      aria-label={isMe ? `${entry.highFives} high-fives` : done ? `You high-fived ${entry.name}` : `High-five ${entry.name}`}
      title={isMe ? "High-fives you've received" : done ? "You high-fived them" : "Give a high-five"}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold tabular-nums transition-all",
        done ? "border-gold/50 bg-gold/15 text-gold" : "border-border text-muted",
        !isMe && !done && "hover:border-gold/50 hover:text-gold active:scale-90",
        isMe && "cursor-default"
      )}
    >
      <span aria-hidden className={cn(mutation.isPending && "animate-bounce")}>👏</span>
      {entry.highFives > 0 && entry.highFives}
    </button>
  );
}

// Medal styling per podium place; colours come from the theme tokens.
const MEDALS = {
  1: { ring: "ring-gold", border: "border-gold/60", text: "text-gold", bg: "from-gold/20", label: "Champion" },
  2: { ring: "ring-silver", border: "border-silver/40", text: "text-silver", bg: "from-silver/10", label: "2nd place" },
  3: { ring: "ring-bronze", border: "border-bronze/40", text: "text-bronze", bg: "from-bronze/10", label: "3rd place" },
} as const;

function PodiumCard({ entry, place, isMe, period, queryKey }: { entry: LeaderboardEntry; place: 1 | 2 | 3; isMe: boolean; period: LeaderboardPeriod; queryKey: unknown[] }) {
  const medal = MEDALS[place];
  return (
    <li
      className={cn(
        "relative flex min-w-0 flex-col items-center rounded-2xl border bg-linear-to-b to-surface px-2 pb-4 text-center sm:px-4 sm:pb-6",
        medal.border,
        medal.bg,
        place === 1 ? "pt-8 shadow-[0_0_48px_-12px_var(--gold)] sm:pt-10" : "pt-6 sm:pt-7"
      )}
    >
      {place === 1 && <Crown aria-hidden className="absolute -top-4 h-8 w-8 fill-gold text-gold drop-shadow-[0_0_10px_var(--gold)]" />}
      <div className="relative">
        <Avatar
          photoUrl={entry.photoUrl}
          name={entry.name}
          size={place === 1 ? "lg" : "md"}
          className={cn("ring-2 ring-offset-2 ring-offset-surface", medal.ring, place !== 1 && "sm:h-20 sm:w-20 sm:text-xl")}
        />
        <span
          className={cn(
            "absolute -bottom-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-surface text-xs font-bold text-accent-foreground",
            place === 1 ? "bg-gold" : place === 2 ? "bg-silver" : "bg-bronze"
          )}
        >
          {place}
        </span>
      </div>
      <p className="mt-4 w-full truncate text-sm font-semibold sm:text-base">
        {entry.name}
        {isMe && <span className="ml-1 text-xs font-normal text-gold">(you)</span>}
      </p>
      <p className={cn("mt-1 font-display text-xl font-bold sm:text-3xl", medal.text)}>{num.format(entry.points)}</p>
      <p className="text-[11px] uppercase tracking-wider text-muted">points</p>
      <div className="mt-3 hidden flex-wrap justify-center gap-1.5 sm:flex">
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">{num.format(entry.caloriesBurned)} kcal</span>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">{duration(entry.gymMinutes)} gym</span>
      </div>
      <p className={cn("mt-3 hidden text-[11px] font-semibold uppercase tracking-[0.18em] sm:block", medal.text)}>{medal.label}</p>
      <div className="mt-3">
        <HighFiveButton entry={entry} period={period} isMe={isMe} queryKey={queryKey} />
      </div>
    </li>
  );
}

function Podium({ top, myId, period, queryKey }: { top: LeaderboardEntry[]; myId: string | undefined; period: LeaderboardPeriod; queryKey: unknown[] }) {
  // 2nd · 1st · 3rd, with the winner raised.
  const slots = [top[1], top[0], top[2]] as const;
  return (
    <ol aria-label="Top three" className="mt-10 grid grid-cols-3 items-end gap-2 sm:gap-5">
      {slots.map((entry, i) => {
        const place = ([2, 1, 3] as const)[i];
        if (!entry) return <li key={place} aria-hidden />;
        return <PodiumCard key={entry.userId} entry={entry} place={place} isMe={entry.userId === myId} period={period} queryKey={queryKey} />;
      })}
    </ol>
  );
}

function RankingsTable({ entries, myId, period, queryKey }: { entries: LeaderboardEntry[]; myId: string | undefined; period: LeaderboardPeriod; queryKey: unknown[] }) {
  return (
    <div className="glass-card mt-6 overflow-hidden">
      <table className="w-full table-fixed text-left text-sm md:table-auto">
        <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="w-14 px-4 py-3 font-medium sm:w-20 sm:px-5">Rank</th>
            <th scope="col" className="px-2 py-3 font-medium">Member</th>
            <th scope="col" className="hidden px-4 py-3 text-right font-medium md:table-cell">Workouts</th>
            <th scope="col" className="hidden px-4 py-3 text-right font-medium md:table-cell">Calories</th>
            <th scope="col" className="hidden px-4 py-3 text-right font-medium md:table-cell">Gym time</th>
            <th scope="col" className="w-20 px-4 py-3 text-right font-medium sm:w-28 sm:px-5">Points</th>
            <th scope="col" className="w-16 py-3 pr-3 sm:w-20 sm:pr-5">
              <span className="sr-only">High-fives</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const mine = e.userId === myId;
            return (
              <tr
                key={e.userId}
                aria-current={mine ? "true" : undefined}
                className={cn("border-b border-border last:border-0", mine ? "bg-gold/5 outline outline-1 -outline-offset-1 outline-gold/50" : "hover:bg-foreground/[0.02]")}
              >
                <td className="px-4 py-3 font-display text-base font-semibold text-muted sm:px-5">#{e.rank}</td>
                <td className="px-2 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar photoUrl={e.photoUrl} name={e.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {e.name}
                        {mine && <span className="ml-1.5 text-xs font-normal text-gold">(you)</span>}
                      </p>
                      {/* Phones: the stat columns fold into one line. */}
                      <p className="truncate text-xs text-muted md:hidden">
                        {e.workouts} workouts · {num.format(e.caloriesBurned)} kcal · {duration(e.gymMinutes)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{e.workouts}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{num.format(e.caloriesBurned)} kcal</td>
                <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">{duration(e.gymMinutes)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-gold sm:px-5">{num.format(e.points)}</td>
                <td className="py-3 pr-3 text-right sm:pr-5">
                  <HighFiveButton entry={e} period={period} isMe={mine} queryKey={queryKey} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Standing({ me }: { me: { rank: number | null; points: number; pointsBehindNext: number } }) {
  const user = useAuthStore((s) => s.user);
  const note =
    me.rank === null
      ? "Log a workout or check in at the gym to get on the board."
      : me.rank === 1
        ? "You're on top — keep it up!"
        : `${num.format(me.pointsBehindNext)} pts behind #${me.rank - 1}`;
  return (
    <div className="glass-card mt-6 flex items-center gap-4 border-gold/30 px-4 py-3.5 sm:px-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
        <Medal className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          Your standing<span className="hidden sm:inline">{user?.name ? ` · ${user.name}` : ""}</span>
        </p>
        <p className="truncate text-sm text-muted">{note}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-2xl font-bold text-gold">{me.rank ? `#${me.rank}` : "—"}</p>
        <p className="text-xs text-muted">{num.format(me.points)} pts</p>
      </div>
    </div>
  );
}

const PRIZE_PHRASE = { daily: "Today's", weekly: "This week's", monthly: "This month's" } as const;

function Prizes({ period, tier }: { period: keyof typeof PRIZE_PHRASE; tier: RewardTier }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm sm:px-5">
      <span className="flex items-center gap-2 font-semibold text-gold">
        <Gift className="h-4 w-4" /> {PRIZE_PHRASE[period]} prizes
      </span>
      {medals.map((m, i) => (
        <span key={m} className="text-muted">
          <span aria-hidden>{m}</span> <span className="text-foreground">{num.format(tier.coins[i])}</span> coins · {num.format(tier.xp[i])} XP
        </span>
      ))}
      <Link href="/rewards" className="ml-auto text-xs font-semibold text-gold hover:underline">
        Spend coins →
      </Link>
    </div>
  );
}

function HowPointsWork({ weights }: { weights: LeaderboardWeights }) {
  const rules = [
    { icon: Dumbbell, label: "Completed workout", value: `${weights.workoutPoints} pts` },
    { icon: Trophy, label: "Gym visit", value: `${weights.visitPoints} pts` },
    { icon: Flame, label: "Calories burned", value: `1 pt / ${weights.caloriesPerPoint} kcal` },
    { icon: Timer, label: "Minute in the gym", value: `${weights.gymMinutePoints} pt` },
    { icon: Timer, label: "Minute of logged exercise", value: `${weights.workoutMinutePoints} pts` },
    { icon: Flame, label: "Day of active streak", value: `${weights.streakPoints} pts` },
  ].filter((r) => !r.value.startsWith("0 "));
  return (
    <details className="glass-card group mt-6 px-4 py-3 sm:px-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <Info className="h-4 w-4 text-gold" /> How points work
      </summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rules.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <r.icon className="h-4 w-4 text-gold/70" /> {r.label}
            </span>
            <span className="font-semibold text-gold">{r.value}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function LeaderboardContent() {
  const me = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [segment, setSegment] = useState<LeaderboardSegment>("all");
  const queryKey = ["leaderboard", period, segment];
  const board = useQuery({ queryKey, queryFn: () => getLeaderboard(period, segment), placeholderData: keepPreviousData });
  const data = board.data;

  return (
    <MemberPage>
      <MemberHeader
        eyebrow="Community"
        title="Leaderboard"
        description="Workouts, gym time, calories and streaks — every rep counts."
        actions={
          <>
            <Link href="/leaderboard/hall-of-fame" className={buttonVariants({ variant: "glass", size: "sm" })}>
              <Landmark className="h-4 w-4" /> Hall of Fame
            </Link>
            <Link href="/rewards" className={buttonVariants({ variant: "glass", size: "sm" })}>
              <Gift className="h-4 w-4" /> Rewards
            </Link>
          </>
        }
      />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs label="Leaderboard period" tabs={PERIODS} value={period} onChange={setPeriod} />
        {data?.enabled && <p className="text-sm text-muted">{rangeLabel(period, data.range)}</p>}
      </div>

      <div className="mt-3">
        <ChipSlider label="Leaderboard group">
          {SEGMENTS.map((g) => (
            <Chip key={g.key} active={segment === g.key} onClick={() => setSegment(g.key)}>
              {g.label}
            </Chip>
          ))}
        </ChipSlider>
        {segment !== "all" && (
          <p className="mt-2 text-xs text-muted">
            Groups use the gender, experience and goal in your{" "}
            <Link href="/settings" className="text-gold hover:underline">
              profile
            </Link>
            .
          </p>
        )}
      </div>

      {board.isPending && (
        <>
          <Skeleton className="mt-6 h-16 w-full rounded-2xl" />
          <div className="mt-10 grid grid-cols-3 items-end gap-3">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-60 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        </>
      )}
      {board.isError && (
        <div className="mt-6">
          <ErrorNote>Could not load the leaderboard. Please try again in a moment.</ErrorNote>
        </div>
      )}

      {data && !data.enabled && (
        <div className="mt-8">
          <EmptyState icon={PauseCircle} title="The leaderboard is paused" description="The gym has switched rankings off for now. Check back soon." />
        </div>
      )}

      {data?.enabled && (
        <div className={cn("transition-opacity", board.isPlaceholderData && "opacity-60")}>
          {data.me && <Standing me={data.me} />}
          <PushPrompt />
          <ProfileCompletionCard className="mt-4" />
          {period !== "all-time" && data.rewards[period]?.enabled && <Prizes period={period} tier={data.rewards[period]} />}

          {data.entries.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                icon={Trophy}
                title={segment === "all" ? `No one's on the board ${PERIOD_NOUN[period]}` : `No one in this group ${PERIOD_NOUN[period] === "yet" ? "yet" : PERIOD_NOUN[period]}`}
                description="Finish a workout or check in at the front desk to claim the top spot."
                action={
                  <Link href="/workout-plans" className={buttonVariants({ size: "sm" })}>
                    Start a workout
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <Podium top={data.entries.slice(0, 3)} myId={me?.id} period={period} queryKey={queryKey} />
              {data.entries.length > 3 && <RankingsTable entries={data.entries.slice(3)} myId={me?.id} period={period} queryKey={queryKey} />}
              {data.totalRanked > data.entries.length && (
                <p className="mt-3 text-center text-xs text-muted">
                  Showing the top {data.entries.length} of {data.totalRanked} members.
                </p>
              )}
            </>
          )}

          <HowPointsWork weights={data.weights} />
        </div>
      )}
    </MemberPage>
  );
}

export default function LeaderboardPage() {
  return (
    <RequireAuth>
      <LeaderboardContent />
    </RequireAuth>
  );
}
