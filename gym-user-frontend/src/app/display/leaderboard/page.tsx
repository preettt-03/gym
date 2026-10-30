"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Crown, Dumbbell, Flame, Timer } from "lucide-react";
import { getDisplayBoards, type DisplayBoard } from "@/lib/leaderboard-api";
import { Avatar } from "@/components/avatar";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

const ROTATE_MS = 30_000;
const REFRESH_MS = 60_000;
const TZ = "Asia/Kolkata";
const clock = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const fullDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const num = new Intl.NumberFormat("en-IN");

const TITLE = { daily: "Today", weekly: "This week" } as const;
const MEDAL = {
  1: "border-gold/70 from-gold/25 shadow-[0_0_90px_-20px_var(--gold)]",
  2: "border-silver/50 from-silver/10",
  3: "border-bronze/50 from-bronze/10",
} as const;
const MEDAL_TEXT = { 1: "text-gold", 2: "text-silver", 3: "text-bronze" } as const;

function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

function subtitle(board: DisplayBoard) {
  const start = new Date(board.range.start);
  if (board.period === "daily") return fullDate.format(start);
  return `${shortDate.format(start)} – ${shortDate.format(new Date(new Date(board.range.end).getTime() - 1))}`;
}

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

// Keep the TV from dimming while the page is up (where the browser allows it).
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
      } catch {
        lock = null;
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-10 text-center">
      <LogoMark className="h-20 w-20" />
      <h1 className="font-display text-4xl font-bold uppercase">{title}</h1>
      <p className="max-w-xl text-lg text-muted">{body}</p>
    </div>
  );
}

function Podium({ board }: { board: DisplayBoard }) {
  const slots = [board.entries[1], board.entries[0], board.entries[2]];
  return (
    <ol className="grid grid-cols-3 items-end gap-[2vw]">
      {slots.map((e, i) => {
        const place = ([2, 1, 3] as const)[i];
        if (!e) return <li key={place} aria-hidden />;
        return (
          <li
            key={e.rank}
            className={cn(
              "relative flex flex-col items-center rounded-[2vw] border bg-linear-to-b to-surface px-[1.2vw] text-center",
              MEDAL[place],
              place === 1 ? "pb-[2.2vw] pt-[3.2vw]" : "pb-[1.6vw] pt-[2.2vw]"
            )}
          >
            {place === 1 && <Crown aria-hidden className="absolute -top-[2.2vw] h-[3.6vw] w-[3.6vw] fill-gold text-gold drop-shadow-[0_0_14px_var(--gold)]" />}
            <Avatar photoUrl={e.photoUrl} name={e.name} size="lg" className={cn(place === 1 ? "h-[8vw] w-[8vw] text-[2.6vw]" : "h-[6vw] w-[6vw] text-[2vw]")} />
            <p className="mt-[1vw] w-full truncate text-[1.6vw] font-semibold">{e.name}</p>
            <p className={cn("font-display text-[3.4vw] font-bold leading-none", MEDAL_TEXT[place])}>{num.format(e.points)}</p>
            <p className="mt-[0.3vw] text-[0.9vw] uppercase tracking-[0.25em] text-muted">points</p>
          </li>
        );
      })}
    </ol>
  );
}

function Rest({ board }: { board: DisplayBoard }) {
  const rest = board.entries.slice(3);
  if (!rest.length) return null;
  return (
    <ol className="flex flex-col gap-[0.7vw]">
      {rest.map((e) => (
        <li key={e.rank} className="flex items-center gap-[1.2vw] rounded-[1vw] border border-border bg-surface px-[1.4vw] py-[0.7vw]">
          <span className="w-[3vw] font-display text-[1.8vw] font-bold text-muted">#{e.rank}</span>
          <Avatar photoUrl={e.photoUrl} name={e.name} className="h-[3vw] w-[3vw] text-[1vw]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.5vw] font-medium leading-tight">{e.name}</span>
            <span className="mt-[0.2vw] flex items-center gap-[0.4vw] text-[0.95vw] text-muted">
              <Dumbbell className="h-[0.95vw] w-[0.95vw]" /> {e.workouts}
              <Flame className="ml-[0.7vw] h-[0.95vw] w-[0.95vw]" /> {num.format(e.caloriesBurned)} kcal
              <Timer className="ml-[0.7vw] h-[0.95vw] w-[0.95vw]" /> {duration(e.gymMinutes)}
            </span>
          </span>
          <span className="w-[8vw] text-right font-display text-[1.9vw] font-bold text-gold">{num.format(e.points)}</span>
        </li>
      ))}
    </ol>
  );
}

function DisplayBoardView() {
  const key = useSearchParams().get("key") ?? "";
  useWakeLock();
  const now = useNow(1000);
  const [slot, setSlot] = useState(0);
  const [slotStartedAt, setSlotStartedAt] = useState(() => Date.now());

  const query = useQuery({
    queryKey: ["display-leaderboard", key],
    queryFn: () => getDisplayBoards(key),
    enabled: Boolean(key),
    refetchInterval: REFRESH_MS,
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 3,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlot((s) => s + 1);
      setSlotStartedAt(Date.now());
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!key || (isAxiosError(query.error) && query.error.response?.status === 404)) {
    return <Message title="Display link not valid" body="This screen's link is missing or was switched off. Ask the gym admin for the current TV link from the Leaderboard page." />;
  }
  if (!query.data) return <Message title="Loading leaderboard…" body="Getting today's rankings." />;
  if (!query.data.enabled) return <Message title="Leaderboard paused" body="Rankings are switched off right now." />;

  const boards = query.data.boards;
  const board = boards[slot % boards.length];
  const progress = Math.min(1, (now - slotStartedAt) / ROTATE_MS);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-[3vw] py-[2.2vw]">
      <div aria-hidden className="pointer-events-none absolute -top-[20vw] left-1/2 h-[40vw] w-[70vw] -translate-x-1/2 rounded-full bg-gold/10 blur-[8vw]" />

      <header className="relative flex items-center justify-between">
        <div className="flex items-center gap-[1.2vw]">
          <LogoMark className="h-[4.5vw] w-[4.5vw]" />
          <div>
            <p className="flex items-center gap-[0.6vw] text-[1vw] font-semibold uppercase tracking-[0.35em] text-gold">
              <span className="h-[0.7vw] w-[0.7vw] animate-pulse rounded-full bg-success" /> Live leaderboard
            </p>
            <h1 className="font-display text-[3.4vw] font-bold uppercase leading-none">
              {TITLE[board.period]} <span className="text-[1.6vw] font-medium normal-case tracking-normal text-muted">· {subtitle(board)}</span>
            </h1>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-[3vw] font-bold leading-none tabular-nums">{clock.format(now)}</p>
          <div className="mt-[0.6vw] flex justify-end gap-[0.5vw]">
            {boards.map((b, i) => (
              <span key={b.period} className={cn("h-[0.35vw] w-[3vw] overflow-hidden rounded-full bg-surface-2")}>
                <span
                  className="block h-full bg-gold"
                  style={{ width: i === slot % boards.length ? `${progress * 100}%` : i < slot % boards.length ? "100%" : "0%" }}
                />
              </span>
            ))}
          </div>
        </div>
      </header>

      {board.entries.length === 0 ? (
        <div className="relative flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-display text-[4vw] font-bold uppercase">No one on the board yet</p>
          <p className="mt-[1vw] text-[1.6vw] text-muted">Check in and log a workout to claim the top spot {board.period === "daily" ? "today" : "this week"}.</p>
        </div>
      ) : (
        <main className={cn("relative mt-[3.5vw] grid flex-1 items-start gap-[3vw]", board.entries.length > 3 ? "grid-cols-[1.15fr_1fr]" : "grid-cols-1 px-[12vw]")}>
          <Podium board={board} />
          <Rest board={board} />
        </main>
      )}

      <footer className="relative mt-[1.5vw] text-center text-[1vw] uppercase tracking-[0.3em] text-muted">Every workout, visit and calorie counts · Lift · Love · Repeat</footer>
    </div>
  );
}

export default function DisplayLeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <DisplayBoardView />
    </Suspense>
  );
}
