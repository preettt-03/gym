"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications-api";
import { useSocket } from "@/hooks/use-socket";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const user = useAuthStore((s) => s.user);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

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

  return (
    <div className="relative">
      <Button variant="glass" size="sm" className="h-9 w-9 p-0" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {Boolean(data?.unreadCount) && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] text-white">
            {data!.unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="glass-panel absolute right-0 top-12 z-50 w-80 max-h-96 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-medium">Notifications</span>
            {Boolean(data?.unreadCount) && (
              <button className="text-xs text-accent hover:underline" onClick={() => readAllMutation.mutate()}>
                Mark all read
              </button>
            )}
          </div>
          {!data?.items.length && <p className="px-1 py-4 text-center text-sm text-muted">No notifications yet.</p>}
          <div className="flex flex-col gap-1">
            {data?.items.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-left text-sm transition hover:bg-foreground/5",
                  !n.isRead && "bg-accent/10"
                )}
                onClick={() => !n.isRead && readMutation.mutate(n.id)}
              >
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-muted">{n.body}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
