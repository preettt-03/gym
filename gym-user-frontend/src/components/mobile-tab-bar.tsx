"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Dumbbell, Menu, MessagesSquare, Tag, X } from "lucide-react";
import { useUiStore } from "@/stores/ui-store";
import { formatUnread, useChatUnread } from "@/hooks/use-chat-unread";
import { cn } from "@/lib/utils";

const LINKS = {
  exercises: { href: "/exercises", label: "Exercises", icon: Dumbbell },
  tools: { href: "/tools", label: "Tools", icon: Calculator },
  pricing: { href: "/pricing", label: "Pricing", icon: Tag },
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass = "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors";

/** Phone/tablet bottom navigation. Hidden while chat is open so it never sits over the message box. */
export function MobileTabBar() {
  const pathname = usePathname();
  const chatOpen = useUiStore((s) => s.chatOpen);
  const menuOpen = useUiStore((s) => s.menuOpen);
  const setMenuOpen = useUiStore((s) => s.setMenuOpen);
  const openChat = useUiStore((s) => s.openChat);
  const unreadChat = useChatUnread().data?.total ?? 0;

  if (chatOpen) return null;

  const link = ({ href, label, icon: Icon }: (typeof LINKS)[keyof typeof LINKS]) => {
    const active = !menuOpen && isActive(pathname, href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={() => setMenuOpen(false)}
        className={cn(itemClass, active ? "text-gold" : "text-muted hover:text-foreground")}
      >
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-2">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(itemClass, menuOpen ? "text-gold" : "text-muted hover:text-foreground")}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          Menu
        </button>
        {link(LINKS.exercises)}
        <button type="button" onClick={openChat} aria-label={unreadChat ? `Chat, ${unreadChat} unread` : "Chat"} className={cn(itemClass, "group text-gold")}>
          <span className="accent-gradient relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full text-accent-foreground shadow-[0_8px_24px_-6px_var(--gold)] ring-4 ring-background transition-transform group-active:scale-95">
            <MessagesSquare className="h-6 w-6" strokeWidth={2.25} />
            {unreadChat > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-danger px-1 text-[10px] font-bold text-white">
                {formatUnread(unreadChat)}
              </span>
            )}
          </span>
          Chat
        </button>
        {link(LINKS.tools)}
        {link(LINKS.pricing)}
      </div>
    </nav>
  );
}
