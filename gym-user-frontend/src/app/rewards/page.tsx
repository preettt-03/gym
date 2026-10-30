"use client";

import { useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Coins, Gift, Loader2, PackageX, Sparkles, Ticket, Trophy, XCircle } from "lucide-react";
import { cancelRedemption, getRewardsStore, listMyRedemptions, redeemReward, type Redemption, type RewardItem } from "@/lib/rewards-api";
import { RequireAuth } from "@/components/require-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorNote, MemberHeader, MemberPage, Panel } from "@/components/member/ui";
import { cn } from "@/lib/utils";

const num = new Intl.NumberFormat("en-IN");
const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const BLOCKED: Record<NonNullable<RewardItem["blockedReason"]>, string> = {
  OUT_OF_STOCK: "Sold out",
  LIMIT_REACHED: "Limit reached",
  NOT_ENOUGH_COINS: "Not enough coins",
};

const STATUS: Record<Redemption["status"], { label: string; className: string; icon: typeof Ticket }> = {
  PENDING: { label: "Ready to collect", className: "bg-gold/15 text-gold", icon: Ticket },
  FULFILLED: { label: "Collected", className: "bg-success/10 text-success", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled · refunded", className: "bg-foreground/10 text-muted", icon: XCircle },
};

function errorText(err: unknown, fallback: string) {
  return isAxiosError(err) ? (err.response?.data?.error?.message ?? fallback) : fallback;
}

function ItemCard({ item, coins, onRedeemed }: { item: RewardItem; coins: number; onRedeemed: (r: Redemption) => void }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const redeem = useMutation({
    mutationFn: () => redeemReward(item.id),
    onSuccess: (r) => {
      setConfirming(false);
      onRedeemed(r);
      queryClient.invalidateQueries({ queryKey: ["rewards-store"] });
      queryClient.invalidateQueries({ queryKey: ["my-redemptions"] });
    },
  });
  const short = Math.max(0, item.costCoins - coins);

  return (
    <li className="glass-card flex flex-col overflow-hidden">
      <div className="relative flex aspect-[16/9] items-center justify-center bg-linear-to-br from-gold/15 to-surface-2">
        {item.imageUrl ? (
          // Admin-supplied URL from any host; next/image would need each one whitelisted.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Gift className="h-12 w-12 text-gold/50" />
        )}
        {item.stock !== null && (
          <span className={cn("absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold", item.stock > 0 ? "bg-background/80 text-foreground" : "bg-danger/90 text-white")}>
            {item.stock > 0 ? `${item.stock} left` : "Sold out"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-semibold">{item.name}</h3>
        {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
        {item.maxPerMember !== null && (
          <p className="mt-2 text-xs text-muted">
            Limit {item.maxPerMember} per member · you have {item.redeemedByMe}
          </p>
        )}
        <div className="mt-auto pt-4">
          <p className="flex items-center gap-1.5 font-display text-2xl font-bold text-gold">
            <Coins className="h-5 w-5" /> {num.format(item.costCoins)}
          </p>
          {confirming ? (
            <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3 text-sm">
              <p>
                Spend <strong>{num.format(item.costCoins)} coins</strong>? You&apos;ll get a code to show at the front desk.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" variant="glass" onClick={() => setConfirming(false)} disabled={redeem.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => redeem.mutate()} disabled={redeem.isPending}>
                  {redeem.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Redeem
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-3 w-full" size="sm" disabled={!item.canRedeem} onClick={() => setConfirming(true)}>
              {item.canRedeem ? "Redeem" : item.blockedReason === "NOT_ENOUGH_COINS" ? `Need ${num.format(short)} more coins` : BLOCKED[item.blockedReason!]}
            </Button>
          )}
          {redeem.isError && <p className="mt-2 text-xs text-danger">{errorText(redeem.error, "Could not redeem. Please try again.")}</p>}
        </div>
      </div>
    </li>
  );
}

function RedemptionRow({ r }: { r: Redemption }) {
  const queryClient = useQueryClient();
  const status = STATUS[r.status];
  const cancel = useMutation({
    mutationFn: () => cancelRedemption(r.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards-store"] });
      queryClient.invalidateQueries({ queryKey: ["my-redemptions"] });
    },
  });
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{r.item.name}</p>
        <p className="text-xs text-muted">
          {when.format(new Date(r.createdAt))} · {num.format(r.coins)} coins
          {r.note && ` · ${r.note}`}
        </p>
      </div>
      {r.status === "PENDING" && (
        <span className="rounded-lg border border-dashed border-gold/50 px-3 py-1 font-mono text-sm font-bold tracking-[0.2em] text-gold" aria-label={`Code ${r.code.split("").join(" ")}`}>
          {r.code}
        </span>
      )}
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs", status.className)}>
        <status.icon className="h-3 w-3" /> {status.label}
      </span>
      {r.status === "PENDING" && (
        <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate()} className="text-xs text-muted hover:text-danger">
          {cancel.isPending ? "Cancelling…" : "Cancel & refund"}
        </button>
      )}
    </li>
  );
}

function RewardsContent() {
  const store = useQuery({ queryKey: ["rewards-store"], queryFn: getRewardsStore });
  const redemptions = useQuery({ queryKey: ["my-redemptions"], queryFn: listMyRedemptions });
  const [justRedeemed, setJustRedeemed] = useState<Redemption | null>(null);
  const coins = store.data?.coins ?? 0;

  return (
    <MemberPage>
      <MemberHeader
        eyebrow="Rewards"
        title="Rewards store"
        description="Spend the coins you earn from leaderboard wins and missions on real perks at the gym."
        actions={
          <div className="glass-card flex items-center gap-3 border-gold/30 px-4 py-2.5">
            <Coins className="h-5 w-5 text-gold" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Your coins</p>
              <p className="font-display text-2xl font-bold leading-none text-gold">{store.data ? num.format(coins) : "…"}</p>
            </div>
          </div>
        }
      />

      {justRedeemed && (
        <div role="status" className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 px-6 py-6 text-center">
          <Sparkles className="h-6 w-6 text-gold" />
          <p className="font-semibold">{justRedeemed.item.name} is yours!</p>
          <p className="text-sm text-muted">Show this code at the front desk to collect it.</p>
          <p className="mt-1 rounded-xl border-2 border-dashed border-gold px-5 py-2 font-mono text-3xl font-bold tracking-[0.3em] text-gold">{justRedeemed.code}</p>
          <button type="button" onClick={() => setJustRedeemed(null)} className="mt-1 text-xs text-muted hover:text-foreground">
            Done
          </button>
        </div>
      )}

      {store.isPending && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      )}
      {store.isError && (
        <div className="mt-8">
          <ErrorNote>Could not load the rewards store. Please try again in a moment.</ErrorNote>
        </div>
      )}
      {store.data && store.data.items.length === 0 && (
        <div className="mt-8">
          <EmptyState icon={PackageX} title="The store is being stocked" description="The gym hasn't added rewards yet — keep earning coins so you're ready." />
        </div>
      )}
      {store.data && store.data.items.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.data.items.map((item) => (
            <ItemCard key={item.id} item={item} coins={coins} onRedeemed={setJustRedeemed} />
          ))}
        </ul>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel icon={Ticket} title="My redemptions">
          {redemptions.isPending && <Skeleton className="h-16 rounded-xl" />}
          {redemptions.data?.length === 0 && <p className="py-4 text-sm text-muted">Nothing redeemed yet.</p>}
          <ul>
            {redemptions.data?.map((r) => (
              <RedemptionRow key={r.id} r={r} />
            ))}
          </ul>
        </Panel>
        <Panel icon={Trophy} title="Earn more coins">
          <ul className="flex flex-col gap-3 text-sm text-muted">
            <li>🥇 Finish in the top 3 of the daily, weekly or monthly leaderboard.</li>
            <li>🎯 Complete missions on your achievements page.</li>
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href="/leaderboard" className={buttonVariants({ variant: "glass", size: "sm" })}>
              Leaderboard
            </Link>
            <Link href="/achievements" className={buttonVariants({ variant: "glass", size: "sm" })}>
              Missions
            </Link>
          </div>
        </Panel>
      </div>
    </MemberPage>
  );
}

export default function RewardsPage() {
  return (
    <RequireAuth>
      <RewardsContent />
    </RequireAuth>
  );
}
