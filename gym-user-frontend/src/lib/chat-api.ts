import { apiClient } from "@/lib/api-client";

export type ChatType = "GLOBAL" | "CHANNEL" | "DIRECT";
export type MessageType = "TEXT" | "IMAGE" | "VOICE" | "SYSTEM";

export interface ChatRoom {
  id: string;
  type: ChatType;
  name: string | null;
}

export interface DirectRoom extends ChatRoom {
  otherUser: { id: string; name: string | null; email: string | null } | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  isPinned: boolean;
  createdAt: string;
  sender: { id: string; name: string | null; email: string | null; photoUrl: string | null };
}

/** What the signed-out preview of the "Everyone" room carries — no contact details. */
export type PublicChatMessage = Pick<ChatMessage, "id" | "roomId" | "senderId" | "content" | "createdAt" | "sender">;

export async function listPublicEveryoneMessages() {
  const { data } = await apiClient.get<{ room: { id: string; name: string | null }; items: PublicChatMessage[] }>(
    "/chat/public/everyone/messages"
  );
  return data;
}

export async function listMyRooms() {
  const { data } = await apiClient.get<{ global: ChatRoom; channels: ChatRoom[]; direct: DirectRoom[] }>(
    "/chat/rooms"
  );
  return data;
}

export async function getOrCreateDirectRoom(userId: string) {
  const { data } = await apiClient.post<{ room: ChatRoom }>("/chat/rooms/direct", { userId });
  return data.room;
}

export async function listMessages(roomId: string, before?: string) {
  const { data } = await apiClient.get<{ items: ChatMessage[]; hasMore: boolean; pagination: { total: number } }>(
    `/chat/rooms/${roomId}/messages`,
    { params: { limit: 30, before } }
  );
  return data;
}

export async function getUnreadCounts() {
  const { data } = await apiClient.get<{ total: number; rooms: Record<string, number> }>("/chat/unread");
  return data;
}

export async function markRoomRead(roomId: string, messageId: string) {
  await apiClient.post(`/chat/rooms/${roomId}/read`, { messageId });
}

export async function sendMessageRest(roomId: string, content: string) {
  const { data } = await apiClient.post<{ message: ChatMessage }>(`/chat/rooms/${roomId}/messages`, {
    type: "TEXT",
    content,
  });
  return data.message;
}

export async function blockUser(userId: string) {
  await apiClient.post(`/chat/users/${userId}/block`);
}

export async function reportMessage(messageId: string, reason?: string) {
  await apiClient.post(`/chat/messages/${messageId}/report`, { reason });
}
