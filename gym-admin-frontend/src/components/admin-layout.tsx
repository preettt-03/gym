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
  MessageSquare,
  ScrollText,
  Target,
  Trophy,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <aside className="glass-panel sticky top-4 mx-4 my-4 flex h-[calc(100vh-2rem)] w-64 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center gap-2 px-2 font-semibold">
          <Dumbbell className="h-5 w-5 text-accent" /> Gym Admin
        </div>

        <nav className="flex flex-1 flex-col gap-4">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className="flex flex-col gap-1">
              {group.label && (
                <div className="px-3 text-[10px] font-medium uppercase tracking-wider text-muted">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                      isActive
                        ? "accent-gradient text-white"
                        : "text-muted hover:bg-foreground/5 hover:text-foreground"
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

        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <div className="truncate text-xs text-muted">{user?.email}</div>
          <ThemeToggle />
        </div>

        <Button
          variant="glass"
          size="sm"
          onClick={() => {
            clearSession();
            navigate("/login");
          }}
        >
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </aside>

      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
