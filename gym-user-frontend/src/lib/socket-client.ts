import { io, type Socket } from "socket.io-client";

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8004/api/v1").replace(/\/api\/v1$/, "");

let socket: Socket | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Lets React (useSyncExternalStore) re-render when the singleton is created or dropped.
export function subscribeSocket(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Reuses the live connection across access-token refreshes instead of tearing it down —
// disconnecting on every refresh (access tokens live 15min) would silently drop room
// subscriptions (e.g. chat rooms, the per-user notification room) without any visible error.
export function connectSocket(accessToken: string): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { auth: { token: accessToken }, autoConnect: true });
    notify();
    return socket;
  }

  socket.auth = { token: accessToken };
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  notify();
}

export function getSocket(): Socket | null {
  return socket;
}
