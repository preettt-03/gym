"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, CreditCard, LineChart, LogOut, QrCode, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();

  return (
    <div className="relative">
      <Button variant="glass" size="sm" className="h-9 w-9 p-0" onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        <User className="h-4 w-4" />
      </Button>

      {open && (
        <div className="glass-panel absolute right-0 top-12 z-50 w-56 p-2">
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
