"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2, X } from "lucide-react";
import { sendEmailChangeOtp, sendPhoneChangeOtp, verifyEmailChange, verifyPhoneChange, type UserProfile } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { ResendCodeButton } from "@/components/resend-code-button";

const message = (err: unknown, fallback: string) =>
  isAxiosError(err) ? (err.response ? err.response.data?.error?.message ?? fallback : "Can't reach the server. Check your connection.") : fallback;

/**
 * Add or change the member's email or mobile number: enter it, receive a
 * code there, type the code back. Nothing changes until the code checks out.
 */
export function ContactDialog({ kind, current, onClose }: { kind: "email" | "phone"; current: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [step, setStep] = useState<"value" | "code">("value");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  // Local test mode only (no SMS provider yet): the code is shown here.
  const [devCode, setDevCode] = useState<string>();

  // Mounted only while open, so every open starts from a clean slate.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  // Both endpoints answer with where the code went (masked for phones) and the cooldown.
  const sendCode = async (): Promise<{ sentTo: string; cooldownSeconds: number; devCode?: string }> => {
    if (kind === "email") {
      const r = await sendEmailChangeOtp(value.trim());
      return { sentTo: r.email, cooldownSeconds: r.cooldownSeconds };
    }
    const r = await sendPhoneChangeOtp(value.trim());
    return { sentTo: r.phone, cooldownSeconds: r.cooldownSeconds, devCode: r.devCode };
  };
  const send = useMutation({
    mutationFn: sendCode,
    onSuccess: (data) => {
      setSentTo(data.sentTo);
      setDevCode(data.devCode);
      setStep("code");
      setError(null);
    },
    onError: (err) => setError(message(err, "Couldn't send the code")),
  });
  const verify = useMutation({
    mutationFn: () => (kind === "email" ? verifyEmailChange(value.trim(), code) : verifyPhoneChange(value.trim(), code)),
    onSuccess: (profile: UserProfile) => {
      queryClient.setQueryData(["my-profile"], profile);
      // Keep the signed-in user's cached contact details in step with the profile.
      if (user && accessToken) setSession(accessToken, { ...user, email: profile.email, phone: profile.phone });
      onClose();
    },
    onError: (err) => setError(message(err, "Couldn't verify the code")),
  });

  const label = kind === "email" ? "email" : "mobile number";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full rounded-t-2xl border border-border bg-surface p-6 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="contact-title" className="text-lg font-semibold">
              {current ? `Change ${label}` : `Add ${label}`}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {step === "value" ? `We'll send a 6-digit code to the new ${label} to confirm it's yours.` : `Enter the code we sent to ${sentTo}.`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          noValidate
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (step === "value") {
              const v = value.trim();
              const bad = !v
                ? `Enter your ${label}`
                : kind === "email"
                  ? !/^\S+@\S+\.\S+$/.test(v) && "Enter a valid email address"
                  : v.replace(/\D/g, "").length < 10 && "Enter a 10-digit mobile number";
              setFieldError(bad || undefined);
              if (!bad) send.mutate();
            } else {
              const bad = !/^\d{6}$/.test(code) && "Enter the 6-digit code";
              setFieldError(bad || undefined);
              if (!bad) verify.mutate();
            }
          }}
        >
          {step === "value" ? (
            <div>
              <label htmlFor="contact-value" className="mb-1.5 block text-sm font-medium">
                New {label}
              </label>
              <Input
                id="contact-value"
                autoFocus
                type={kind === "email" ? "email" : "tel"}
                inputMode={kind === "email" ? "email" : "tel"}
                placeholder={kind === "email" ? "you@example.com" : "98765 43210"}
                value={value}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby="contact-value-error"
                onChange={(e) => setValue(e.target.value)}
              />
              <FieldError id="contact-value-error" message={fieldError} />
            </div>
          ) : (
            <div>
              {devCode && (
                <p className="mb-3 rounded-xl border border-dashed border-gold/50 bg-gold/5 px-3 py-2 text-xs" role="status">
                  <span className="font-semibold text-gold">Test mode</span> — SMS isn&apos;t connected yet. Code:{" "}
                  <button type="button" onClick={() => setCode(devCode)} className="font-mono font-bold tracking-widest text-gold hover:underline">
                    {devCode}
                  </button>
                </p>
              )}
              <label htmlFor="contact-code" className="mb-1.5 block text-sm font-medium">
                Verification code
              </label>
              <Input
                id="contact-code"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="text-center font-mono text-lg tracking-[0.5em]"
                value={code}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby="contact-code-error"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <FieldError id="contact-code-error" message={fieldError} />
            </div>
          )}
          <FormAlert message={error} />
          <Button type="submit" disabled={send.isPending || verify.isPending}>
            {(send.isPending || verify.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === "value" ? "Send code" : `Confirm ${label}`}
          </Button>
          {step === "code" && (
            <div className="flex items-center justify-between gap-3">
              <ResendCodeButton channel={kind === "email" ? "email" : "sms"} startCoolingDown onResend={sendCode} />
              <button type="button" onClick={() => setStep("value")} className="text-xs text-muted hover:text-foreground">
                Use a different {label}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
