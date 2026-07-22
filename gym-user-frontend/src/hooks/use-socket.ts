"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/auth-store";
import { connectSocket, disconnectSocket } from "@/lib/socket-client";

export function useSocket(): Socket | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      setSocket(null);
      return;
    }
    const s = connectSocket(accessToken);
    setSocket(s);

    return () => {
      // Intentionally do not disconnect here: the socket is a shared singleton
      // that should persist across component unmounts within the same session.
    };
  }, [accessToken]);

  return socket;
}
