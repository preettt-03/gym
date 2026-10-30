"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, ChevronRight, Flag, Hash, Loader2, MessagesSquare, Send, User, X } from "lucide-react";
import {
  blockUser,
  listMessages,
  listMyRooms,
  listPublicEveryoneMessages,
  markRoomRead,
  reportMessage,
  sendMessageRest,
  type ChatMessage,
  type DirectRoom,
  type PublicChatMessage,
} from "@/lib/chat-api";
import { useSocket } from "@/hooks/use-socket";
import { CHAT_UNREAD_KEY, formatUnread, useChatUnread } from "@/hooks/use-chat-unread";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote } from "@/components/member/ui";
import { cn } from "@/lib/utils";

const TZ = "Asia/Kolkata";
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const MAX_LENGTH = 2000;
// Guests have no socket, so their read-only view of "Everyone" refreshes on a timer.
const GUEST_REFRESH_MS = 15_000;

interface RoomOption {
  id: string;
  label: string;
  kind: "channel" | "direct";
  otherUserId?: string;
}

/**
 * Chat as a side panel: a right-hand column on desktop (the page shrinks to
 * make room, see AppShell) and a full-screen sheet on phones. Inside it's a
 * conversation list that drills into one conversation.
 */
export function ChatPanel() {
  const open = useUiStore((s) => s.chatOpen);
  const closeChat = useUiStore((s) => s.closeChat);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && closeChat();
    document.addEventListener("keydown", onKeyDown);
    // Phones get a full-screen sheet, so the page behind must not scroll.
    document.body.classList.add("chat-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("chat-open");
    };
  }, [open, closeChat]);

  if (!open || !hasHydrated) return null;

  return (
    <aside
      aria-label="Chat"
      className="fixed inset-0 z-[60] flex flex-col bg-background lg:left-auto lg:w-[var(--chat-w)] lg:border-l lg:border-border lg:shadow-2xl lg:shadow-elevation"
    >
      {accessToken ? <MemberChat onClose={closeChat} /> : <GuestChat onClose={closeChat} />}
    </aside>
  );
}

function PanelHeader({ title, onBack, onClose, children }: { title: React.ReactNode; onBack?: () => void; onClose: () => void; children?: React.ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <h2 className={cn("flex min-w-0 flex-1 items-center gap-2 font-semibold", !onBack && "pl-2")}>{title}</h2>
      {children}
      <button type="button" onClick={onClose} aria-label="Close chat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground">
        <X className="h-5 w-5" />
      </button>
    </header>
  );
}

function RoomRow({
  icon: Icon,
  label,
  hint,
  onSelect,
  trailing,
  unread = 0,
}: {
  icon: typeof Hash;
  label: string;
  hint?: string;
  onSelect: () => void;
  trailing?: React.ReactNode;
  unread?: number;
}) {
  return (
    <li>
      <button type="button" onClick={onSelect} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-foreground/5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-gold">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", unread ? "font-semibold text-foreground" : "font-medium")}>{label}</span>
          {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
        </span>
        {unread > 0 && (
          <span aria-label={`${unread} unread`} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-accent-foreground">
            {formatUnread(unread)}
          </span>
        )}
        {trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-muted" />}
      </button>
    </li>
  );
}

/** Guests can read "Everyone"; replying sends them to log in, then back here. */
function GuestChat({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const setReopen = useUiStore((s) => s.setReopenChatAfterLogin);
  const scrollRef = useRef<HTMLDivElement>(null);
  const feed = useQuery({ queryKey: ["chat-public-everyone"], queryFn: listPublicEveryoneMessages, refetchInterval: GUEST_REFRESH_MS });
  const messages = feed.data?.items ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const goLogin = () => {
    setReopen(true);
    onClose();
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
  };

  return (
    <>
      <PanelHeader
        onClose={onClose}
        title={
          <>
            <Hash className="h-4 w-4 shrink-0 text-gold" />
            <span className="truncate">Everyone</span>
          </>
        }
      />
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {feed.isPending && <MessagesSkeleton />}
        {feed.isError && <ErrorNote>Could not load messages.</ErrorNote>}
        {feed.data && messages.length === 0 && <EmptyRoom text="No messages yet — log in and say hi!" />}
        <MessageList messages={messages} myId={undefined} readOnly />
      </div>
      <div className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="mb-2 text-center text-xs text-muted">
          <button type="button" onClick={goLogin} className="font-semibold text-gold hover:underline">
            Log in
          </button>{" "}
          to join the conversation
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="chat-input-guest" className="sr-only">
            Message
          </label>
          <Input id="chat-input-guest" placeholder="Type a message..." readOnly onFocus={goLogin} onClick={goLogin} />
          <Button type="button" className="h-11 w-11 shrink-0 p-0" onClick={goLogin} aria-label="Log in to send a message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

function MessagesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-2/3 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      <Skeleton className="h-10 w-3/5 rounded-2xl" />
    </div>
  );
}

function EmptyRoom({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-muted">
      <MessagesSquare className="h-9 w-9 text-gold/60" />
      <p className="mt-3">{text}</p>
    </div>
  );
}

/** Messages grouped under day dividers. */
function MessageList({ messages, myId, readOnly }: { messages: PublicChatMessage[]; myId: string | undefined; readOnly?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {messages.map((m, i) => {
        const d = day.format(new Date(m.createdAt));
        const divider = i === 0 || d !== day.format(new Date(messages[i - 1].createdAt));
        return (
          <li key={m.id} className="contents">
            {divider && (
              <p className="my-2 text-center text-[11px] uppercase tracking-widest text-muted" role="separator">
                {d}
              </p>
            )}
            <ul>
              <MessageBubble message={m} mine={m.senderId === myId} readOnly={readOnly} />
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function MemberChat({ onClose }: { onClose: () => void }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const rooms = useQuery({ queryKey: ["chat-rooms"], queryFn: listMyRooms });
  const unread = useChatUnread().data?.rooms;

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
  const room = options.find((o) => o.id === roomId);

  if (room) return <Conversation key={room.id} room={room} onBack={() => setRoomId(null)} onClose={onClose} />;

  return (
    <>
      <PanelHeader title="Chat" onClose={onClose} />
      <nav aria-label="Conversations" className="flex-1 overflow-y-auto overscroll-contain p-2">
        {rooms.isPending && (
          <div className="flex flex-col gap-2 p-1">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}
        {rooms.isError && <ErrorNote>Could not load conversations.</ErrorNote>}
        <ul>
          {options.map((o) => (
            <RoomRow
              key={o.id}
              icon={o.kind === "direct" ? User : Hash}
              label={o.label}
              hint={o.kind === "direct" ? "Direct message" : o.label === "Everyone" ? "Whole gym" : "Channel"}
              onSelect={() => setRoomId(o.id)}
              unread={unread?.[o.id]}
            />
          ))}
        </ul>
      </nav>
      <p className="border-t border-border px-4 py-3 text-xs text-muted">Be kind — messages that break the gym&apos;s community rules can be reported and removed.</p>
    </>
  );
}

function Conversation({ room, onBack, onClose }: { room: RoomOption; onBack: () => void; onClose: () => void }) {
  const me = useAuthStore((s) => s.user);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  // Messages that arrived over the socket (or were just sent).
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const typingTimer = useRef<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Newest page first; older pages are fetched as the member scrolls up.
  const history = useInfiniteQuery({
    queryKey: ["chat-messages", room.id],
    queryFn: ({ pageParam }) => listMessages(room.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items[0]?.id : undefined),
  });
  const topRef = useRef<HTMLDivElement>(null);
  const heightBeforeOlder = useRef<number | null>(null);

  const addLive = (msg: ChatMessage) => setLive((prev) => (msg.roomId !== room.id || prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));

  // History plus live messages, de-duplicated (a sent message can come back over the socket too).
  const messages = useMemo(() => {
    const seen = new Set<string>();
    const fetched = (history.data?.pages ?? []).slice().reverse().flatMap((p) => p.items);
    return [...fetched, ...live].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [history.data, live]);
  const lastId = messages[messages.length - 1]?.id;

  const loadOlder = useCallback(() => {
    if (!history.hasNextPage || history.isFetchingNextPage) return;
    heightBeforeOlder.current = scrollRef.current?.scrollHeight ?? null;
    void history.fetchNextPage();
  }, [history]);

  // Older messages went in above: keep the member looking at the same message.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || heightBeforeOlder.current === null) return;
    el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
    heightBeforeOlder.current = null;
  }, [history.data?.pages.length]);

  // A new message at the bottom: follow it (instantly on first load).
  const firstScroll = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !lastId) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [lastId]);

  // Reaching the top loads the page before it.
  useEffect(() => {
    const el = topRef.current;
    if (!el || !scrollRef.current) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && !firstScroll.current && loadOlder(), {
      root: scrollRef.current,
      rootMargin: "120px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadOlder]);

  // Seeing the latest message marks the room read.
  useEffect(() => {
    if (!lastId) return;
    markRoomRead(room.id, lastId)
      .then(() => queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY }))
      .catch(() => undefined);
  }, [lastId, room.id, queryClient]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("chat:join", { roomId: room.id });
    const onMessage = (msg: ChatMessage) => addLive(msg);
    const onTyping = (p: { roomId: string; userId: string }) => {
      if (p.userId === me?.id || p.roomId !== room.id) return;
      setTyping(true);
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setTyping(false), 2500);
    };
    socket.on("chat:message", onMessage);
    socket.on("chat:typing", onTyping);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:typing", onTyping);
      window.clearTimeout(typingTimer.current);
    };
    // addLive only depends on room.id, which is already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, room.id, me?.id]);

  const send = useMutation({
    mutationFn: (content: string) => sendMessageRest(room.id, content),
    onSuccess: (msg) => {
      addLive(msg);
      setDraft("");
    },
  });

  const block = useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
      onBack();
    },
  });

  return (
    <>
      <PanelHeader
        onBack={onBack}
        onClose={onClose}
        title={
          <>
            {room.kind === "direct" ? <User className="h-4 w-4 shrink-0 text-gold" /> : <Hash className="h-4 w-4 shrink-0 text-gold" />}
            <span className="truncate">{room.label}</span>
          </>
        }
      >
        {room.kind === "direct" && room.otherUserId && !confirmBlock && (
          <button type="button" onClick={() => setConfirmBlock(true)} aria-label={`Block ${room.label}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-danger/10 hover:text-danger">
            <Ban className="h-4 w-4" />
          </button>
        )}
      </PanelHeader>

      {confirmBlock && room.otherUserId && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-danger/5 px-4 py-2.5 text-xs">
          <span className="flex-1">Block {room.label}?</span>
          <Button size="sm" variant="destructive" className="h-8" disabled={block.isPending} onClick={() => block.mutate(room.otherUserId!)}>
            Block
          </Button>
          <Button size="sm" variant="glass" className="h-8" onClick={() => setConfirmBlock(false)}>
            Cancel
          </Button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {history.isPending && <MessagesSkeleton />}
        {history.isError && <ErrorNote>Could not load messages.</ErrorNote>}
        {history.data && messages.length === 0 && <EmptyRoom text="No messages yet — say hi!" />}
        <div ref={topRef} aria-hidden />
        {history.hasNextPage && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={history.isFetchingNextPage}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-gold/50 hover:text-gold"
            >
              {history.isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin" />}
              {history.isFetchingNextPage ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
        <MessageList messages={messages} myId={me?.id} />
      </div>

      <p className="h-5 shrink-0 px-4 text-xs text-muted">{typing ? "Someone is typing…" : ""}</p>

      <form
        className="flex shrink-0 items-end gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) send.mutate(draft.trim());
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
          autoComplete="off"
          onChange={(e) => {
            setDraft(e.target.value);
            socket?.emit("chat:typing", { roomId: room.id });
          }}
        />
        <Button type="submit" className="h-11 w-11 shrink-0 p-0" disabled={!draft.trim() || send.isPending} aria-label="Send message">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      {send.isError && <p className="px-4 pb-3 text-xs text-danger">Message not sent. Check your connection and try again.</p>}
    </>
  );
}

function MessageBubble({ message, mine, readOnly }: { message: PublicChatMessage; mine: boolean; readOnly?: boolean }) {
  const [reporting, setReporting] = useState(false);
  const report = useMutation({ mutationFn: (reason: string) => reportMessage(message.id, reason) });

  return (
    <li className={cn("group flex flex-col", mine && "items-end")}>
      <div className={cn("flex max-w-[85%] items-end gap-2", mine && "flex-row-reverse")}>
        {!mine && <Avatar photoUrl={message.sender.photoUrl} name={message.sender.name} email={message.sender.email} className="h-7 w-7" />}
        <div className={cn("min-w-0 rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-md bg-gold text-accent-foreground" : "rounded-bl-md bg-surface-2")}>
          {!mine && <p className="mb-0.5 text-xs font-semibold text-gold">{message.sender.name ?? message.sender.email ?? "Member"}</p>}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
      <div className={cn("mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted", mine ? "flex-row-reverse" : "pl-9")}>
        <time dateTime={message.createdAt}>{time.format(new Date(message.createdAt))}</time>
        {!mine &&
          !readOnly &&
          (report.isSuccess ? (
            <span className="text-success">Reported — thanks</span>
          ) : reporting ? (
            <span className="flex flex-wrap items-center gap-1">
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
              className="flex items-center gap-1 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-100"
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
