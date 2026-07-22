"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";
import { AccountMenu } from "@/components/account-menu";
import { MarketingMenu } from "@/components/marketing-menu";
import { useAuthStore } from "@/stores/auth-store";

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  return (
    <header className="sticky top-4 z-50 mx-auto mt-4 w-[95%] max-w-5xl">
      <nav className="glass-panel flex items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Dumbbell className="h-5 w-5 text-accent" />
          <span>Gym Platform</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/exercises" className="hidden text-sm text-muted hover:text-foreground sm:block">
            Exercises
          </Link>
          <MarketingMenu />
          {user ? (
            <>
              <Link href="/dashboard" className="hidden text-sm text-muted hover:text-foreground sm:block">
                Dashboard
              </Link>
              {user.role === "TRAINER" && (
                <Link href="/trainer" className="hidden text-sm text-muted hover:text-foreground sm:block">
                  Trainees
                </Link>
              )}
              <Link href="/workout-plans" className="hidden text-sm text-muted hover:text-foreground md:block">
                Workouts
              </Link>
              <Link href="/diet-plans" className="hidden text-sm text-muted hover:text-foreground md:block">
                Diet
              </Link>
              <Link href="/nutrition" className="hidden text-sm text-muted hover:text-foreground md:block">
                Nutrition
              </Link>
              <Link href="/chat" className="hidden text-sm text-muted hover:text-foreground md:block">
                Chat
              </Link>
              <Link href="/ai-coach" className="hidden text-sm text-muted hover:text-foreground md:block">
                AI Coach
              </Link>
              <NotificationsBell />
              <AccountMenu />
            </>
          ) : (
            <Button variant="glass" size="sm" onClick={() => router.push("/login")}>
              Log in
            </Button>
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
