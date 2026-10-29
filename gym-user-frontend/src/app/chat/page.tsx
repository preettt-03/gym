"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Hash, Send, Users as UsersIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ChatMessage, ChatRoom, listMessages, listMyRooms, sendMessageRest } from "@/lib/chat-api";
import { useSocket } from "@/hooks/use-socket";
import { useAuthStore } from "@/stores/auth-store";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function RoomButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
        active ? "accent-gradient text-accent-foreground" : "text-muted hover:bg-foreground/5 hover:text-foreground"
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ChatContent() {
  const currentUser = useAuthStore((s) => s.user);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: rooms } = useQuery({ queryKey: ["chat-rooms"], queryFn: listMyRooms });

  useEffect(() => {
    if (!selectedRoomId && rooms?.global) setSelectedRoomId(rooms.global.id);
  }, [rooms, selectedRoomId]);

  const { data: history } = useQuery({
    queryKey: ["chat-messages", selectedRoomId],
    queryFn: () => listMessages(selectedRoomId!),
    enabled: Boolean(selectedRoomId),
  });

  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  useEffect(() => setLiveMessages([]), [selectedRoomId]);

  const messages = useMemo(() => [...(history?.items ?? []), ...liveMessages], [history, liveMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    if (!socket || !selectedRoomId) return;
    socket.emit("chat:join", { roomId: selectedRoomId });

    const onMessage = (msg: ChatMessage) => {
      if (msg.roomId !== selectedRoomId) return;
      setLiveMessages((prev) => [...prev, msg]);
    };
    const onTyping = (payload: { roomId: string; userId: string }) => {
      if (payload.roomId !== selectedRoomId || payload.userId === currentUser?.id) return;
      setTypingUserId(payload.userId);
      setTimeout(() => setTypingUserId(null), 2000);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:typing", onTyping);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
    };
  }, [socket, selectedRoomId, currentUser?.id]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessageRest(selectedRoomId!, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-rooms"] }),
  });

  const selectedRoom: ChatRoom | undefined =
    rooms &&
    ([rooms.global, ...rooms.channels, ...rooms.direct].find((r) => r.id === selectedRoomId) as ChatRoom | undefined);

  const selectedRoomLabel =
    selectedRoom?.type === "DIRECT"
      ? rooms?.direct.find((r) => r.id === selectedRoomId)?.otherUser?.name ?? "Direct message"
      : (selectedRoom?.name ?? "Chat");

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-10 md:grid-cols-[240px_1fr]">
      <motion.aside initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card flex flex-col gap-1 p-3">
        {rooms?.global && (
          <RoomButton
            active={selectedRoomId === rooms.global.id}
            icon={<Hash className="h-4 w-4" />}
            label="Global"
            onClick={() => setSelectedRoomId(rooms.global.id)}
          />
        )}
        {rooms?.channels.map((c) => (
          <RoomButton
            key={c.id}
            active={selectedRoomId === c.id}
            icon={<Hash className="h-4 w-4" />}
            label={c.name ?? "Channel"}
            onClick={() => setSelectedRoomId(c.id)}
          />
        ))}
        {rooms?.direct.map((d) => (
          <RoomButton
            key={d.id}
            active={selectedRoomId === d.id}
            icon={<UsersIcon className="h-4 w-4" />}
            label={d.otherUser?.name ?? d.otherUser?.email ?? "Direct message"}
            onClick={() => setSelectedRoomId(d.id)}
          />
        ))}
      </motion.aside>

      <Card className="flex h-[70vh] flex-col p-0">
        <div className="border-b border-white/10 px-5 py-4 font-medium">{selectedRoomLabel}</div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col", m.senderId === currentUser?.id && "items-end")}>
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2 text-sm",
                    m.senderId === currentUser?.id ? "accent-gradient text-accent-foreground" : "glass-input"
                  )}
                >
                  {m.senderId !== currentUser?.id && (
                    <div className="mb-0.5 text-xs font-medium text-accent">{m.sender.name ?? m.sender.email}</div>
                  )}
                  {m.content}
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                </div>
              </div>
            ))}
            {messages.length === 0 && <p className="text-center text-sm text-muted">No messages yet. Say hi!</p>}
          </div>
        </div>

        <div className="h-5 px-5 text-xs text-muted">{typingUserId && "Someone is typing..."}</div>

        <form
          className="flex items-center gap-2 border-t border-white/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            sendMutation.mutate(draft.trim());
            setDraft("");
          }}
        >
          <Input
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (socket && selectedRoomId) socket.emit("chat:typing", { roomId: selectedRoomId });
            }}
          />
          <Button type="submit" size="sm" className="h-11 w-11 p-0" disabled={!draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function ChatPage() {
  return (
    <RequireAuth>
      <ChatContent />
    </RequireAuth>
  );
}
