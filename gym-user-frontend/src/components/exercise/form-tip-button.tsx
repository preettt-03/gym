"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { getFormTip } from "@/lib/ai-api";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

// AI-generated form cue for one exercise (members only).
export function FormTipButton({ exerciseId }: { exerciseId: string }) {
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const [tip, setTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (tip) {
      setTip(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getFormTip(exerciseId);
      setTip(result.tip);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Could not fetch a form tip right now.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthed) return null;

  return (
    <div>
      <Button variant="glass" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-gold" />}
        {loading ? "Getting tip..." : tip ? "Hide AI tip" : "AI form tip"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
      {tip && <p className="mt-3 whitespace-pre-line rounded-xl border border-gold/20 bg-gold/5 p-3 text-sm text-foreground/85">{tip}</p>}
    </div>
  );
}
