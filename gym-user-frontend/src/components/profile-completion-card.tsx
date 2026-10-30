"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserRoundCheck, X } from "lucide-react";
import { getMyProfile } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const FIELDS = [
  { key: "gender", label: "Sex" },
  { key: "experienceLevel", label: "Experience" },
  { key: "fitnessGoal", label: "Goal" },
] as const;

/**
 * Nudges members to fill in the profile fields the leaderboard groups use
 * (Women/Men, Beginners…, Fat loss/Strength). Hidden once complete or snoozed.
 */
export function ProfileCompletionCard({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const storageKey = `profile-card-snoozed:${user?.id}`;
  const [snoozed, setSnoozed] = useState(() => Number(window.localStorage.getItem(storageKey) ?? 0) > Date.now());
  // Same key as settings, so saving there hides this straight away.
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile, enabled: Boolean(user) });

  const missing = profile ? FIELDS.filter((f) => !profile[f.key]) : [];
  if (!profile || missing.length === 0 || snoozed) return null;

  const snooze = () => {
    window.localStorage.setItem(storageKey, String(Date.now() + SNOOZE_MS));
    setSnoozed(true);
  };

  return (
    <section className={cn("glass-card relative flex flex-col gap-4 border-gold/30 p-5 sm:flex-row sm:items-center", className)}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
        <UserRoundCheck className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Complete your profile to compete in your group</h2>
        <p className="mt-0.5 text-sm text-muted">
          Leaderboard groups like Women, Beginners and Fat loss use these. Missing:{" "}
          {missing.map((f, i) => (
            <span key={f.key} className="font-medium text-foreground">
              {f.label}
              {i < missing.length - 1 ? ", " : ""}
            </span>
          ))}
          .
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href="/settings#gender" className={buttonVariants({ size: "sm" })}>
          Complete profile
        </Link>
        <button type="button" onClick={snooze} aria-label="Not now" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-foreground/5 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
