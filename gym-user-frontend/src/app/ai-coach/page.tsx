"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Info, Loader2, RotateCw, Send, Sparkles, Trash2 } from "lucide-react";
import { clearAiChatHistory, getAiChatHistory, sendAiChatMessage, type AiChatMessage } from "@/lib/ai-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, MemberPage } from "@/components/member/ui";
import { aiErrorMessage } from "@/components/member/ai-form";
import { cn } from "@/lib/utils";

const HISTORY_KEY = ["ai-chat-history"];
const MAX_LENGTH = 2000;
const SUGGESTIONS = [
  "How do I fix my squat depth?",
  "What should I eat after an evening workout?",
  "Give me a 20-minute core routine",
  "How much protein do I need to build muscle?",
];

type History = { messages: AiChatMessage[] };

function Bubble({ message }: { message: AiChatMessage }) {
  const isUser = message.role === "user";
  return (
    <li className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15">
          <Bot className="h-4 w-4 text-gold" />
        </span>
      )}
      {/* Plain text with preserved line breaks — never rendered as HTML. */}
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]",
          isUser ? "rounded-br-md bg-gold text-accent-foreground" : "rounded-bl-md bg-surface-2"
        )}
      >
        {message.content}
      </p>
    </li>
  );
}

function AiCoachContent() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const history = useQuery({ queryKey: HISTORY_KEY, queryFn: getAiChatHistory });
  const messages = history.data?.messages ?? [];

  const append = (m: AiChatMessage) => queryClient.setQueryData<History>(HISTORY_KEY, (old) => ({ messages: [...(old?.messages ?? []), m] }));

  const send = useMutation({
    mutationFn: (text: string) => sendAiChatMessage(text),
    onMutate: (text) => {
      setFailed(null);
      setInput("");
      const temp: AiChatMessage = { id: `temp-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() };
      append(temp);
      return { tempId: temp.id };
    },
    onSuccess: (result) => append({ id: `reply-${Date.now()}`, role: "assistant", content: result.reply, createdAt: new Date().toISOString() }),
    // Put the question back so nothing the member typed is lost.
    onError: (_err, text, ctx) => {
      queryClient.setQueryData<History>(HISTORY_KEY, (old) => ({ messages: (old?.messages ?? []).filter((m) => m.id !== ctx?.tempId) }));
      setFailed(text);
      setInput(text);
    },
  });

  const clear = useMutation({
    mutationFn: clearAiChatHistory,
    onSuccess: () => {
      queryClient.setQueryData<History>(HISTORY_KEY, { messages: [] });
      setConfirmClear(false);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, send.isPending]);

  const submit = (text = input) => {
    const trimmed = text.trim();
    if (trimmed && !send.isPending) send.mutate(trimmed.slice(0, MAX_LENGTH));
  };

  return (
    <MemberPage className="max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Ask anything</p>
          <h1 className="mt-3 flex items-center gap-3 text-4xl font-bold uppercase">
            <Bot className="h-8 w-8 text-gold" /> AI Coach
          </h1>
          <p className="mt-1 text-muted">Workouts, form, nutrition and motivation — answers use your profile for context.</p>
        </div>
        {messages.length > 0 &&
          (confirmClear ? (
            <span className="flex items-center gap-2 text-sm">
              Delete the whole conversation?
              <Button size="sm" variant="destructive" disabled={clear.isPending} onClick={() => clear.mutate()}>
                Delete
              </Button>
              <Button size="sm" variant="glass" onClick={() => setConfirmClear(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button variant="glass" size="sm" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-4 w-4" /> Clear conversation
            </Button>
          ))}
      </div>

      <section className="glass-card mt-6 flex h-[65vh] min-h-[28rem] flex-col overflow-hidden" aria-label="Conversation with the AI coach">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5" aria-live="polite">
          {history.isPending && (
            <div className="flex flex-col gap-3">
              <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
            </div>
          )}
          {history.data && messages.length === 0 && !send.isPending && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                <Sparkles className="h-6 w-6 text-gold" />
              </span>
              <p className="mt-4 font-medium">What do you want to work on today?</p>
              <ul className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => submit(s)} className="rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-gold/50 hover:text-foreground">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="flex flex-col gap-4">
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {send.isPending && (
              <li className="flex gap-3" role="status">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15">
                  <Bot className="h-4 w-4 text-gold" />
                </span>
                <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3" aria-label="Coach is typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-gold/70" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
              </li>
            )}
          </ul>
        </div>

        {send.isError && failed && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            <div className="flex-1">
              <ErrorNote>{aiErrorMessage(send.error)}</ErrorNote>
            </div>
            <Button size="sm" variant="glass" onClick={() => submit(failed)}>
              <RotateCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        )}

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="ai-input" className="sr-only">
            Your question
          </label>
          <textarea
            id="ai-input"
            ref={inputRef}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder="Type your question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter adds a new line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="glass-input max-h-32 min-h-11 flex-1 resize-none px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
          />
          <Button type="submit" className="h-11 w-11 shrink-0 p-0" disabled={!input.trim() || send.isPending} aria-label="Send question">
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </section>

      <p className="mt-3 flex gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" /> The AI coach gives general fitness information, not medical advice. For pain, injuries or health conditions, talk to a
        doctor or one of our trainers.
      </p>
    </MemberPage>
  );
}

export default function AiCoachPage() {
  return (
    <RequireAuth>
      <AiCoachContent />
    </RequireAuth>
  );
}
