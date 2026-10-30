"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { FlaskConical, Loader2, Mail, MessageSquareText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { ResendCodeButton } from "@/components/resend-code-button";

const message = (err: unknown, fallback: string) =>
  isAxiosError(err) ? (err.response ? err.response.data?.error?.message ?? fallback : "Can't reach the server. Check your connection and try again.") : fallback;

/** "Enter the 6-digit code we sent to …" — shared by code login and mobile sign-up. */
export function CodeStep({
  channel,
  sentTo,
  submitLabel,
  onVerify,
  onResend,
  onBack,
  backLabel,
  devCode: initialDevCode,
}: {
  channel: "email" | "sms";
  sentTo: string;
  submitLabel: string;
  onVerify: (code: string) => Promise<unknown>;
  onResend: () => Promise<{ cooldownSeconds: number; devCode?: string }>;
  onBack: () => void;
  backLabel: string;
  /** Local test mode only: the code, because no SMS provider is connected yet. */
  devCode?: string;
}) {
  const [devCode, setDevCode] = useState(initialDevCode);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const Icon = channel === "sms" ? MessageSquareText : Mail;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!/^\d{6}$/.test(code)) return setFieldError("Enter the 6-digit code");
        setFieldError(undefined);
        setPending(true);
        try {
          await onVerify(code);
        } catch (err) {
          setError(message(err, "Couldn't verify the code"));
          setPending(false);
        }
      }}
    >
      <p className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <span>
          We sent a 6-digit code {channel === "sms" ? "by SMS" : "by email"} to <span className="font-semibold">{sentTo}</span>.
          <button type="button" onClick={onBack} className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
            <Pencil className="h-3 w-3" /> {backLabel}
          </button>
        </span>
      </p>
      {devCode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-gold/50 bg-gold/5 px-4 py-3 text-sm" role="status">
          <FlaskConical className="h-4 w-4 shrink-0 text-gold" />
          <span className="flex-1">
            <span className="font-semibold text-gold">Test mode</span> — SMS isn&apos;t connected yet, so here&apos;s your code:{" "}
            <span className="font-mono font-bold tracking-widest">{devCode}</span>
          </span>
          <button type="button" onClick={() => setCode(devCode)} className="text-xs font-semibold text-gold hover:underline">
            Use this code
          </button>
        </div>
      )}
      <div>
        <label htmlFor="otp" className="mb-1.5 block text-sm font-medium">
          Verification code
        </label>
        <Input
          id="otp"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="text-center font-mono text-lg tracking-[0.5em]"
          value={code}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby="otp-error"
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
        />
        <FieldError id="otp-error" message={fieldError} />
      </div>
      <FormAlert message={error} />
      <Button type="submit" disabled={pending} className="uppercase tracking-wider">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
      </Button>
      <ResendCodeButton
        channel={channel}
        startCoolingDown
        onResend={async () => {
          const result = await onResend();
          setDevCode(result.devCode);
          return result;
        }}
      />
    </form>
  );
}
