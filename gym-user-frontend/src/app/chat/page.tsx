"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Flag, Hash, Loader2, MessageSquare, Send, User } from "lucide-react";
import { blockUser, listMessages, listMyRooms, reportMessage, sendMessageRest, type ChatMessage, type DirectRoom } from "@/lib/chat-api";
import { useSocket } from "@/hooks/use-socket";
import { useAuthStore } from "@/stores/auth-store";
import { RequireAuth } from "@/components/require-auth";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, MemberPage } from "@/components/member/ui";
import { cn } from "@/lib/utils";

const TZ = "Asia/Kolkata";
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const MAX_LENGTH = 2000;

interface RoomOption {
  id: string;
  label: string;
  kind: "channel" | "direct";
  otherUserId?: string;
}

function RoomItem({ room, active, onSelect }: { room: RoomOption; active: boolean; onSelect: () => void }) {
  const Icon = room.kind === "direct" ? User : Hash;
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors md:w-full",
        active ? "bg-gold text-accent-foreground" : "text-muted hover:bg-foreground/5 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{room.label}</span>
    </button>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const [reporting, setReporting] = useState(false);
  const report = useMutation({ mutationFn: (reason: string) => reportMessage(message.id, reason) });

  return (
    <li className={cn("group flex flex-col", mine && "items-end")}>
      <div className={cn("flex max-w-[85%] items-end gap-2 sm:max-w-[75%]", mine && "flex-row-reverse")}>
        {!mine && <Avatar photoUrl={message.sender.photoUrl} name={message.sender.name} email={message.sender.email} className="h-8 w-8" />}
        <div className={cn("min-w-0 rounded-2xl px-4 py-2.5 text-sm", mine ? "rounded-br-md bg-gold text-accent-foreground" : "rounded-bl-md bg-surface-2")}>
          {!mine && <p className="mb-0.5 text-xs font-semibold text-gold">{message.sender.name ?? message.sender.email}</p>}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
      <div className={cn("mt-1 flex items-center gap-2 text-[11px] text-muted", mine ? "flex-row-reverse" : "pl-10")}>
        <time dateTime={message.createdAt}>{time.format(new Date(message.createdAt))}</time>
        {!mine &&
          (report.isSuccess ? (
            <span className="text-success">Reported — thanks</span>
          ) : reporting ? (
            <span className="flex items-center gap-1">
              Report as:
              {["Spam", "Abusive", "Inappropriate"].map((r) => (
                <button key={r} type="button" disabled={report.isPending} onClick={() => report.mutate(r)} className="rounded px-1.5 py-0.5 hover:bg-foreground/10 hover:text-foreground">
                  {r}
                </button>
              ))}
              <button type="button" onClick={() => setReporting(false)} className="px-1 hover:text-foreground">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="flex items-center gap-1 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Report message from ${message.sender.name ?? message.sender.email}`}
            >
              <Flag className="h-3 w-3" /> Report
            </button>
          ))}
      </div>
      {report.isError && <p className="text-[11px] text-danger">Couldn&apos;t send the report.</p>}
    </li>
  );
}

function ChatContent() {
  const me = useAuthStore((s) => s.user);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Messages that arrived over the socket (or were just sent), per room.
  const [live, setLive] = useState<Record<string, ChatMessage[]>>({});
  const [typing, setTyping] = useState<{ roomId: string; userId: string } | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const typingTimer = useRef<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rooms = useQuery({ queryKey: ["chat-rooms"], queryFn: listMyRooms });
  const options: RoomOption[] = useMemo(() => {
    if (!rooms.data) return [];
    return [
      { id: rooms.data.global.id, label: "Everyone", kind: "channel" as const },
      ...rooms.data.channels.map((c) => ({ id: c.id, label: c.name ?? "Channel", kind: "channel" as const })),
      ...rooms.data.direct.map((d: DirectRoom) => ({
        id: d.id,
        label: d.otherUser?.name ?? d.otherUser?.email ?? "Direct message",
        kind: "direct" as const,
        otherUserId: d.otherUser?.id,
      })),
    ];
  }, [rooms.data]);
  const roomId = selected ?? options[0]?.id ?? null;
  const room = options.find((o) => o.id === roomId);

  const history = useQuery({ queryKey: ["chat-messages", roomId], queryFn: () => listMessages(roomId!), enabled: Boolean(roomId) });

  const addLive = (msg: ChatMessage) =>
    setLive((prev) => {
      const list = prev[msg.roomId] ?? [];
      return list.some((m) => m.id === msg.id) ? prev : { ...prev, [msg.roomId]: [...list, msg] };
    });

  // History plus live messages, de-duplicated (a sent message can come back over the socket too).
  const messages = useMemo(() => {
    const seen = new Set<string>();
    return [...(history.data?.items ?? []), ...(roomId ? live[roomId] ?? [] : [])].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [history.data, live, roomId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, roomId]);

  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit("chat:join", { roomId });
    const onMessage = (msg: ChatMessage) => addLive(msg);
    const onTyping = (p: { roomId: string; userId: string }) => {
      if (p.userId === me?.id) return;
      setTyping(p);
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setTyping(null), 2500);
    };
    socket.on("chat:message", onMessage);
    socket.on("chat:typing", onTyping);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
      window.clearTimeout(typingTimer.current);
    };
  }, [socket, roomId, me?.id]);

  const send = useMutation({
    mutationFn: (content: string) => sendMessageRest(roomId!, content),
    onSuccess: (msg) => {
      addLive(msg);
      setDraft("");
    },
  });

  const block = useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: () => {
      setConfirmBlock(false);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });

  let lastDay = "";

  return (
    <MemberPage className="max-w-6xl">
      <p className="eyebrow">Community</p>
      <h1 className="mt-3 text-4xl font-bold uppercase">Chat</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-[260px_1fr]">
        <nav aria-label="Conversations" className="glass-card flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible">
          {rooms.isPending && <Skeleton className="h-10 w-full rounded-xl" />}
          {options.map((o) => (
            <RoomItem key={o.id} room={o} active={o.id === roomId} onSelect={() => (setSelected(o.id), setConfirmBlock(false))} />
          ))}
        </nav>

        <section aria-label={room?.label ?? "Chat"} className="glass-card flex h-[70vh] min-h-[28rem] flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-semibold">
              {room?.kind === "direct" ? <User className="h-4 w-4 text-gold" /> : <Hash className="h-4 w-4 text-gold" />}
              {room?.label ?? "Chat"}
            </h2>
            {room?.kind === "direct" && room.otherUserId && (
              confirmBlock ? (
                <span className="flex items-center gap-2 text-xs">
                  Block {room.label}?
                  <Button size="sm" variant="destructive" className="h-8" disabled={block.isPending} onClick={() => block.mutate(room.otherUserId!)}>
                    Block
                  </Button>
                  <Button size="sm" variant="glass" className="h-8" onClick={() => setConfirmBlock(false)}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 text-muted" onClick={() => setConfirmBlock(true)}>
                  <Ban className="h-4 w-4" /> Block
                </Button>
              )
            )}
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
            {history.isPending && roomId && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-2/3 rounded-2xl" />
                <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                <Skeleton className="h-10 w-3/5 rounded-2xl" />
              </div>
            )}
            {history.isError && <ErrorNote>Could not load messages.</ErrorNote>}
            {history.data && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted">
                <MessageSquare className="h-9 w-9 text-gold/60" />
                <p className="mt-3">No messages yet — say hi!</p>
              </div>
            )}
            <ul className="flex flex-col gap-3">
              {messages.map((m) => {
                const d = day.format(new Date(m.createdAt));
                const divider = d !== lastDay;
                lastDay = d;
                return (
                  <li key={m.id} className="contents">
                    {divider && (
                      <p className="my-2 text-center text-[11px] uppercase tracking-widest text-muted" role="separator">
                        {d}
                      </p>
                    )}
                    <ul>
                      <MessageBubble message={m} mine={m.senderId === me?.id} />
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="h-5 px-5 text-xs text-muted">{typing && typing.roomId === roomId ? "Someone is typing…" : ""}</p>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim() && roomId) send.mutate(draft.trim());
            }}
          >
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <Input
              id="chat-input"
              placeholder="Type a message..."
              maxLength={MAX_LENGTH}
              value={draft}
              disabled={!roomId}
              onChange={(e) => {
                setDraft(e.target.value);
                if (socket && roomId) socket.emit("chat:typing", { roomId });
              }}
            />
            <Button type="submit" className="h-11 w-11 shrink-0 p-0" disabled={!draft.trim() || send.isPending} aria-label="Send message">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          {send.isError && <p className="px-4 pb-3 text-xs text-danger">Message not sent. Check your connection and try again.</p>}
        </section>
      </div>
      <p className="mt-3 text-xs text-muted">Be kind — messages that break the gym&apos;s community rules can be reported and removed.</p>
    </MemberPage>
  );
}

export default function ChatPage() {
  return (
    <RequireAuth>
      <ChatContent />
    </RequireAuth>
  );
}
