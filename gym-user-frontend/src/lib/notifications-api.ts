import { apiClient } from "@/lib/api-client";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

// Where tapping a notification should take the member. "chat" opens the side panel.
const TYPE_LINKS: Record<string, string> = {
  LEADERBOARD: "/leaderboard",
  REWARD: "/rewards",
  MEMBERSHIP_EXPIRY: "/membership",
  WORKOUT_REMINDER: "/workout-plans",
  DIET_REMINDER: "/diet-plans",
  MISSION_REMINDER: "/achievements",
  CHAT_MESSAGE: "chat",
};

export function notificationLink(n: AppNotification): string | null {
  const explicit = n.data?.link;
  // Only same-site paths, never a full URL from a payload.
  if (typeof explicit === "string" && /^\/(?![/\\])/.test(explicit)) return explicit;
  return TYPE_LINKS[n.type] ?? null;
}

export async function listNotifications() {
  const { data } = await apiClient.get<{ items: AppNotification[]; unreadCount: number }>("/notifications");
  return data;
}

export async function markNotificationRead(id: string) {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await apiClient.post("/notifications/read-all");
}
