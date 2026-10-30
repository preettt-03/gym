"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Coins, Sparkles, X } from "lucide-react";
import { listCelebrations, markCelebrationSeen, type Celebration } from "@/lib/leaderboard-api";
import { useAuthStore } from "@/stores/auth-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PERIOD_PHRASE: Record<Celebration["period"], string> = { daily: "yesterday", weekly: "last week", monthly: "last month" };
const PLACE = { 1: { label: "#1", medal: "🥇", tone: "text-gold" }, 2: { label: "#2", medal: "🥈", tone: "text-silver" }, 3: { label: "#3", medal: "🥉", tone: "text-bronze" } } as const;
const CONFETTI_COLORS = ["var(--gold)", "var(--gold-light)", "var(--gold-dark)", "#ffffff", "var(--silver)", "var(--bronze)"];
const num = new Intl.NumberFormat("en-IN");

// Fixed pseudo-random layout so every piece is stable across renders.
const PIECES = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2) % 1;
  return {
    left: `${r(1) * 100}%`,
    delay: `${r(2) * 1.6}s`,
    duration: `${2.6 + r(3) * 2.2}s`,
    drift: `${(r(4) - 0.5) * 160}px`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.round(r(5) * 6),
    round: i % 3 === 0,
  };
});

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden motion-reduce:hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={cn("absolute -top-4 block", p.round ? "rounded-full" : "rounded-[2px]")}
          style={
            {
              left: p.left,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              background: p.color,
              animation: `confetti-fall ${p.duration} ${p.delay} cubic-bezier(0.25, 0.6, 0.4, 1) forwards`,
              "--drift": p.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Shows a member their latest unseen podium finish, once, with confetti. */
export function CelebrationModal() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { data } = useQuery({ queryKey: ["leaderboard-celebrations"], queryFn: listCelebrations, enabled: Boolean(accessToken), staleTime: 5 * 60 * 1000 });
  // Best finish first if several cycles closed at once (e.g. day and week on a Monday).
  const current = data?.slice().sort((a, b) => a.rank - b.rank)[0];

  const seen = useMutation({
    mutationFn: (id: string) => markCelebrationSeen(id),
    onMutate: (id) => queryClient.setQueryData<Celebration[]>(["leaderboard-celebrations"], (old) => old?.filter((c) => c.id !== id)),
  });
  const dismiss = () => current && seen.mutate(current.id);

  useEffect(() => {
    if (!current) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && seen.mutate(current.id);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // seen.mutate is stable enough for a one-off listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;
  const place = PLACE[current.rank as 1 | 2 | 3] ?? PLACE[3];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={dismiss}>
      <Confetti />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl border border-gold/40 bg-surface p-7 text-center shadow-[0_0_80px_-20px_var(--gold)] motion-safe:animate-[pop-in_0.45s_cubic-bezier(0.2,0.9,0.3,1.3)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-6xl" aria-hidden>
          {place.medal}
        </p>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
          <Sparkles className="h-3.5 w-3.5" /> Congratulations
        </p>
        <h2 id="celebration-title" className="mt-2 font-display text-3xl font-bold uppercase leading-tight">
          You finished <span className={place.tone}>{place.label}</span> {PERIOD_PHRASE[current.period]}!
        </h2>
        <p className="mt-2 text-sm text-muted">{num.format(current.points)} points on the leaderboard. The whole gym saw that.</p>

        <ul className="mt-5 flex flex-col gap-2 text-left text-sm">
          {current.coins > 0 && (
            <li className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
              <Coins className="h-4 w-4 text-gold" /> <span className="font-semibold text-gold">+{num.format(current.coins)}</span> coins added to your wallet
            </li>
          )}
          {current.xp > 0 && (
            <li className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
              <Sparkles className="h-4 w-4 text-gold" /> <span className="font-semibold text-gold">+{num.format(current.xp)}</span> XP
            </li>
          )}
          {current.badgeName && (
            <li className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5">
              <Award className="h-4 w-4 text-gold" /> <span className="font-semibold">{current.badgeName}</span> badge
            </li>
          )}
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href="/rewards" onClick={dismiss} className={buttonVariants({ variant: "glass" })}>
            Spend coins
          </Link>
          <Link href="/leaderboard" onClick={dismiss} className={buttonVariants()}>
            Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
