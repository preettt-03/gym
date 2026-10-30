"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import { AccountMenu } from "@/components/account-menu";
import { MarketingMenu, MARKETING_LINKS } from "@/components/marketing-menu";
import { Logo } from "@/components/logo";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { formatUnread, useChatUnread } from "@/hooks/use-chat-unread";
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
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/ai-coach", label: "AI Coach" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  // Opened from the Menu tab in the mobile bottom bar.
  const mobileOpen = useUiStore((s) => s.menuOpen);
  const setMobileOpen = useUiStore((s) => s.setMenuOpen);
  const chatOpen = useUiStore((s) => s.chatOpen);
  const toggleChat = useUiStore((s) => s.toggleChat);
  const unreadChat = useChatUnread().data?.total ?? 0;

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
          {user && <NotificationsBell />}
          {/* Phones reach chat from the bottom tab bar. */}
          <button
            type="button"
            aria-label={chatOpen ? "Close chat" : unreadChat ? `Open chat, ${unreadChat} unread` : "Open chat"}
            aria-expanded={chatOpen}
            onClick={toggleChat}
            className={cn(
              buttonVariants({ variant: "glass", size: "sm" }),
              "relative hidden h-9 w-9 p-0 hover:border-gold/50 hover:text-gold lg:inline-flex",
              chatOpen && "accent-gradient border-transparent text-accent-foreground hover:text-accent-foreground"
            )}
          >
            <MessagesSquare className="h-[18px] w-[18px]" />
            {unreadChat > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-danger px-1 text-[10px] font-bold text-white">
                {formatUnread(unreadChat)}
              </span>
            )}
          </button>
          {user ? (
            <AccountMenu />
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm font-medium uppercase tracking-wider text-foreground/80 hover:text-gold">
                Log in
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className={cn(buttonVariants({ size: "sm" }), "px-3.5 text-xs uppercase tracking-wider sm:px-4 sm:text-sm")}>
                Join now
              </Link>
            </>
          )}
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-menu" className="h-[calc(100dvh-4.5rem-4rem-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain border-t border-border bg-background px-4 pb-10 pt-4 lg:hidden">
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
