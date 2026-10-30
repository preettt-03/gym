"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MessageSquare, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import { AccountMenu } from "@/components/account-menu";
import { MarketingMenu, MARKETING_LINKS } from "@/components/marketing-menu";
import { Logo } from "@/components/logo";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/exercises", label: "Exercises" },
  { href: "/pricing", label: "Pricing" },
];

const MEMBER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workout-plans", label: "Workouts" },
  { href: "/diet-plans", label: "Diet" },
  { href: "/nutrition", label: "Nutrition" },
  { href: "/exercises", label: "Exercises" },
  { href: "/ai-coach", label: "AI Coach" },
  // Members see their own plan plus the plans they can buy or renew.
  { href: "/membership", label: "Plans" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryLinks = user
    ? [...MEMBER_LINKS, ...(user.role === "TRAINER" ? [{ href: "/trainer", label: "Trainees" }] : [])]
    : PUBLIC_LINKS;

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
        <Link href="/" aria-label="King's Fitness home" onClick={() => setMobileOpen(false)}>
          <Logo preload />
        </Link>

        <div className="hidden items-center gap-4 lg:flex xl:gap-7">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              className={cn(
                "whitespace-nowrap text-sm font-medium uppercase tracking-wider transition-colors hover:text-gold",
                isActive(pathname, link.href) ? "text-gold" : "text-foreground/80"
              )}
            >
              {link.label}
            </Link>
          ))}
          <MarketingMenu />
        </div>

        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <NotificationsBell />
              <Link
                href="/chat"
                aria-label="Chat"
                aria-current={isActive(pathname, "/chat") ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: "glass", size: "sm" }),
                  "h-9 w-9 p-0",
                  isActive(pathname, "/chat") && "border-gold/50 text-gold"
                )}
              >
                <MessageSquare className="h-4 w-4" />
              </Link>
              <AccountMenu />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm font-medium uppercase tracking-wider text-foreground/80 hover:text-gold sm:block">
                Log in
              </Link>
              <Link href="/register" className={cn(buttonVariants({ size: "sm" }), "hidden uppercase tracking-wider sm:inline-flex")}>
                Join now
              </Link>
            </>
          )}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-menu" className="h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-border bg-background px-4 pb-10 pt-4 lg:hidden">
          <ul className="flex flex-col">
            {[...primaryLinks, ...MARKETING_LINKS].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block border-b border-border py-3.5 font-display text-lg uppercase tracking-wider",
                    isActive(pathname, link.href) ? "text-gold" : "text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          {!user && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link href="/login" onClick={() => setMobileOpen(false)} className={buttonVariants({ variant: "outline" })}>
                Log in
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className={buttonVariants()}>
                Join now
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
