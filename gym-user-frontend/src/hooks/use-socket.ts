"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/auth-store";
import { connectSocket, disconnectSocket, getSocket, subscribeSocket } from "@/lib/socket-client";

// Shared socket for the logged-in session. The effect only connects or
// disconnects; components read the singleton through useSyncExternalStore.
export function useSocket(): Socket | null {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken) connectSocket(accessToken);
    else disconnectSocket();
    // Intentionally no cleanup: the socket should persist across component
    // unmounts within the same session.
  }, [accessToken]);

  return useSyncExternalStore(subscribeSocket, getSocket, () => null);
}
