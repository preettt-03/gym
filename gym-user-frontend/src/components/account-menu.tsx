"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Award, CreditCard, LineChart, LogOut, QrCode, Settings } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { getMyProfile } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";

const LINKS = [
  { href: "/membership", label: "Membership", icon: CreditCard },
  { href: "/attendance", label: "Attendance", icon: QrCode },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();
  // Same key as the settings page, so a new photo shows up here straight away.
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile, enabled: Boolean(user) });
  const name = profile?.name ?? user?.name;
  const email = profile?.email ?? user?.email;

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-border transition hover:ring-gold/60"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <Avatar photoUrl={profile?.photoUrl} name={name} email={email} />
      </button>

      {open && (
        <div className="glass-panel absolute right-0 top-12 z-50 w-64 p-2">
          <div className="mb-1 flex items-center gap-3 border-b border-border px-3 pb-3 pt-2">
            <Avatar photoUrl={profile?.photoUrl} name={name} email={email} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name ?? "Member"}</p>
              <p className="truncate text-xs text-muted">{email}</p>
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
