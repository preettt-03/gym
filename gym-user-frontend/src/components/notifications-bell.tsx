"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { listNotifications, markAllNotificationsRead, markNotificationRead, notificationLink, type AppNotification } from "@/lib/notifications-api";
import { useUiStore } from "@/stores/ui-store";
import { useSocket } from "@/hooks/use-socket";
import { useDismiss } from "@/hooks/use-dismiss";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

export function NotificationsBell() {
  const user = useAuthStore((s) => s.user);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const router = useRouter();
  const openChat = useUiStore((s) => s.openChat);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, useCallback(() => setOpen(false), []));

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!socket) return;
    const handler = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
    socket.on("notification:new", handler);
    return () => {
      socket.off("notification:new", handler);
    };
  }, [socket, queryClient]);

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (!user) return null;

  const openNotification = (n: AppNotification) => {
    if (!n.isRead) readMutation.mutate(n.id);
    const link = notificationLink(n);
    if (!link) return;
    setOpen(false);
    if (link === "chat") openChat();
    else router.push(link);
  };

  const unread = data?.unreadCount ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="glass"
        size="sm"
        className={cn("h-9 w-9 p-0", open && "border-gold/50 text-gold")}
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      {open && (
        // Phones: full-width sheet under the header. Larger screens: anchored dropdown.
        <div className="rounded-2xl border border-border bg-surface shadow-2xl shadow-elevation fixed inset-x-3 top-[4.75rem] z-50 flex flex-col overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button type="button" className="text-xs font-semibold text-gold hover:underline" onClick={() => readAllMutation.mutate()}>
                Mark all read
              </button>
            )}
          </div>
          {!data?.items.length ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No notifications yet.</p>
          ) : (
            <ul className="flex max-h-[min(24rem,60dvh)] flex-col gap-1 overflow-y-auto overscroll-contain p-2">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-foreground/5",
                      !n.isRead && "bg-gold/10"
                    )}
                    onClick={() => openNotification(n)}
                  >
                    <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-gold")} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{n.title}</span>
                      {n.body && <span className="mt-0.5 block break-words text-xs text-muted">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-muted/80">{timeAgo(n.createdAt)}</span>
                    </span>
                    {notificationLink(n) && <ChevronRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-muted" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
