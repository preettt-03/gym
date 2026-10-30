"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, Check, Loader2, X } from "lucide-react";
import { getVapidConfig, isPushSupported, subscribeToPush } from "@/lib/push-client";
import { Button } from "@/components/ui/button";

const SNOOZE_KEY = "push-prompt-snoozed-until";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Asks for push at the moment it obviously helps — on the leaderboard, where
 * "someone just overtook you" alerts make sense. Only when the browser hasn't
 * been asked yet; never re-asks after a block.
 */
export function PushPrompt() {
  const [hidden, setHidden] = useState(
    () => !isPushSupported() || Notification.permission !== "default" || Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now()
  );
  const vapid = useQuery({ queryKey: ["vapid-config"], queryFn: getVapidConfig, enabled: !hidden, staleTime: Infinity });
  const enable = useMutation({ mutationFn: subscribeToPush });

  if (hidden || !vapid.data?.configured) return null;

  const snooze = () => {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setHidden(true);
  };

  if (enable.data?.ok) {
    return (
      <p role="status" className="mt-4 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        <Check className="h-4 w-4" /> Alerts are on — we&apos;ll tell you when someone passes you or you win.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-gold/25 bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
      <BellRing className="h-5 w-5 shrink-0 text-gold" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Don&apos;t lose your spot without knowing</p>
        <p className="text-muted">Get a phone alert when someone overtakes you, and when you win a prize.</p>
        {enable.data && !enable.data.ok && <p className="mt-1 text-xs text-danger">{enable.data.reason}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => enable.mutate()} disabled={enable.isPending}>
          {enable.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Turn on alerts
        </Button>
        <button type="button" onClick={snooze} aria-label="Not now" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-foreground/5 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
