import { apiClient } from "@/lib/api-client";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
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
