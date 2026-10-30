"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Award, CreditCard, Gift, LineChart, LogOut, QrCode, Settings, Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { getMyProfile } from "@/lib/profile-api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useDismiss } from "@/hooks/use-dismiss";

const LINKS = [
  { href: "/membership", label: "Membership", icon: CreditCard },
  { href: "/attendance", label: "Attendance", icon: QrCode },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/rewards", label: "Rewards store", icon: Gift },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, useCallback(() => setOpen(false), []));
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();
  // Same key as the settings page, so a new photo shows up here straight away.
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile, enabled: Boolean(user) });
  const name = profile?.name ?? user?.name;
  const email = profile?.email ?? user?.email;
  const contact = email ?? profile?.phone ?? user?.phone;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn("flex h-9 w-9 items-center justify-center rounded-full ring-1 transition hover:ring-gold/60", open ? "ring-gold" : "ring-border")}
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <Avatar photoUrl={profile?.photoUrl} name={name} email={email} />
      </button>

      {open && (
        // Phones: full-width sheet under the header. Larger screens: anchored dropdown.
        <div className="rounded-2xl border border-border bg-surface shadow-2xl shadow-elevation fixed inset-x-3 top-[4.75rem] z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto p-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-64">
          <div className="mb-1 flex items-center gap-3 border-b border-border px-3 pb-3 pt-2">
            <Avatar photoUrl={profile?.photoUrl} name={name} email={email} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name ?? "Member"}</p>
              <p className="truncate text-xs text-muted">{contact}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-foreground/5 hover:text-foreground"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
            <button
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
              onClick={() => {
                setOpen(false);
                clearSession();
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
