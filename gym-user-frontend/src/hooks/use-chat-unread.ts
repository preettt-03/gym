import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUnreadCounts } from "@/lib/chat-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSocket } from "@/hooks/use-socket";

export const CHAT_UNREAD_KEY = ["chat-unread"];

/**
 * Unread chat messages for the signed-in member. Polls gently (sockets only
 * reach rooms a member has open), and refreshes at once when a message lands.
 */
export function useChatUnread() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
    socket.on("chat:message", refresh);
    return () => {
      socket.off("chat:message", refresh);
    };
  }, [socket, queryClient]);

  return useQuery({
    queryKey: CHAT_UNREAD_KEY,
    queryFn: getUnreadCounts,
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function formatUnread(n: number) {
  return n > 99 ? "99+" : String(n);
}
