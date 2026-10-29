import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  Bot,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ScrollText,
  Target,
  Trophy,
  UtensilsCrossed,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const NAV_GROUPS = [
  {
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Catalog",
    items: [
      { to: "/users", label: "Users", icon: Users, end: false },
      { to: "/exercises", label: "Exercises", icon: Dumbbell, end: false },
      { to: "/workout-plans", label: "Workout Plans", icon: Dumbbell, end: false },
      { to: "/diet-plans", label: "Diet Plans", icon: UtensilsCrossed, end: false },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/membership-plans", label: "Membership Plans", icon: CreditCard, end: false },
      { to: "/attendance", label: "Attendance", icon: CalendarCheck, end: false },
      { to: "/missions", label: "Missions & Badges", icon: Trophy, end: false },
      { to: "/cms", label: "Content (CMS)", icon: FileText, end: false },
    ],
  },
  {
    label: "Community",
    items: [
      { to: "/chat", label: "Chat", icon: MessageSquare, end: false },
      { to: "/notifications", label: "Notifications", icon: Bell, end: false },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/segments", label: "Segments", icon: Target, end: false },
      { to: "/reports", label: "Reports", icon: ClipboardList, end: false },
      { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, end: false },
    ],
  },
  {
    label: "AI",
    items: [{ to: "/ai-management", label: "AI Management", icon: Bot, end: false }],
  },
];

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <img src={logo} alt="" className="h-10 w-10" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-base font-bold uppercase tracking-wider text-gold">King&apos;s Fitness</span>
        <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-muted">Admin</span>
      </span>
    </span>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  return (
    <>
      <nav className="flex flex-1 flex-col gap-5" aria-label="Admin">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="flex flex-col gap-1">
            {group.label && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{group.label}</div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "border-gold/30 bg-gold/10 font-medium text-gold"
                      : "border-transparent text-muted hover:bg-foreground/5 hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-sm text-gold">
            {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user?.name || "Admin"}</div>
            <div className="truncate text-xs text-muted">{user?.email}</div>
          </div>
        </div>
        <Button
          variant="glass"
          size="sm"
          className="w-full"
          onClick={() => {
            clearSession();
            navigate("/login");
          }}
        >
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </div>
    </>
  );
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-5 lg:flex">
        <Brand />
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md lg:hidden">
          <Brand />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div aria-hidden="true" className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
