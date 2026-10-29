"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CheckCircle2, Loader2, RotateCw } from "lucide-react";
import type { CodeSentResponse } from "@/lib/api";
import { useCooldown } from "@/hooks/use-cooldown";

const DEFAULT_COOLDOWN = 60;

// "Didn't get a code?" action with a server-matched cooldown. Pass
// startCoolingDown when a code was sent just before this screen opened.
export function ResendCodeButton({
  onResend,
  startCoolingDown = false,
}: {
  onResend: () => Promise<CodeSentResponse>;
  startCoolingDown?: boolean;
}) {
  const { remaining, start } = useCooldown(startCoolingDown ? DEFAULT_COOLDOWN : 0);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: onResend,
    onSuccess: (data) => {
      start(data.cooldownSeconds ?? DEFAULT_COOLDOWN);
      setStatus({ ok: true, text: "A new code is on its way. Check your inbox and spam folder." });
    },
    onError: (err) => {
      setStatus({
        ok: false,
        text: isAxiosError(err) ? err.response?.data?.error?.message ?? "Couldn't send a new code" : "Couldn't send a new code",
      });
    },
  });

  return (
    <div className="text-sm">
      <span className="text-muted">Didn&apos;t get a code? </span>
      <button
        type="button"
        onClick={() => {
          setStatus(null);
          mutation.mutate();
        }}
        disabled={remaining > 0 || mutation.isPending}
        className="inline-flex items-center gap-1.5 font-semibold text-gold hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
      >
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
        {remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
      </button>
      {status && (
        <p role="status" className={`mt-2 flex items-start gap-1.5 text-xs ${status.ok ? "text-success" : "text-danger"}`}>
          {status.ok && <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />}
          {status.text}
        </p>
      )}
    </div>
  );
}
