"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, Trash2 } from "lucide-react";
import { clearAiChatHistory, getAiChatHistory, sendAiChatMessage } from "@/lib/ai-api";
import type { AiChatMessage } from "@/lib/ai-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";
import { cn } from "@/lib/utils";

function Bubble({ message }: { message: AiChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
          isUser ? "accent-gradient text-white" : "glass-card"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function AiCoachContent() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({ queryKey: ["ai-chat-history"], queryFn: getAiChatHistory });
  const messages = data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setInput("");

    const optimisticUser: AiChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData<{ messages: AiChatMessage[] }>(["ai-chat-history"], (old) => ({
      messages: [...(old?.messages ?? []), optimisticUser],
    }));

    try {
      const result = await sendAiChatMessage(trimmed);
      queryClient.setQueryData<{ messages: AiChatMessage[] }>(["ai-chat-history"], (old) => ({
        messages: [
          ...(old?.messages ?? []),
          {
            id: `reply-${Date.now()}`,
            role: "assistant",
            content: result.reply,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to reach the AI coach. Please try again.";
      setError(message);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    await clearAiChatHistory();
    queryClient.setQueryData(["ai-chat-history"], { messages: [] });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-10" style={{ minHeight: "80vh" }}>
      <div className="flex items-center justify-between">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-2xl font-semibold"
        >
          <Bot className="h-6 w-6 text-accent" /> AI Coach
        </motion.h1>
        <Button variant="glass" size="sm" onClick={handleClear}>
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
      </div>
      <p className="mt-1 text-muted">Ask anything about workouts, nutrition, or general fitness.</p>

      <Card className="mt-6 flex flex-1 flex-col gap-3 overflow-y-auto p-4" style={{ minHeight: "50vh", maxHeight: "60vh" }}>
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
            <Sparkles className="h-8 w-8 text-accent" />
            <p>Ask me anything — form tips, workout ideas, nutrition advice.</p>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {sending && <Bubble message={{ id: "typing", role: "assistant", content: "Thinking...", createdAt: "" }} />}
        <div ref={bottomRef} />
      </Card>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Input
          placeholder="Type your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <Button onClick={handleSend} disabled={sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AiCoachPage() {
  return (
    <RequireAuth>
      <AiCoachContent />
    </RequireAuth>
  );
}
