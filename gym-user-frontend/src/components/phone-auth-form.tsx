"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2, Mail, MessageSquareText, Pencil, Smartphone } from "lucide-react";
import { sendPhoneOtp, verifyPhoneOtp, type PhoneMode } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { ResendCodeButton } from "@/components/resend-code-button";
import { cn } from "@/lib/utils";

type ApiError = { message: string; code?: string };
const readError = (err: unknown, fallback: string): ApiError => {
  if (!isAxiosError(err)) return { message: fallback };
  if (!err.response) return { message: "Can't reach the server. Check your connection and try again." };
  return { message: err.response.data?.error?.message ?? fallback, code: err.response.data?.error?.details?.code };
};

// Accepts "98765 43210", "+91 98765-43210", "09876543210"…; the server normalises.
const looksLikePhone = (v: string) => v.replace(/\D/g, "").length >= 10;

/** Email / Mobile switch shown above the sign-in and sign-up forms. */
export function MethodTabs({ value, onChange }: { value: "email" | "phone"; onChange: (v: "email" | "phone") => void }) {
  return (
    <div role="tablist" aria-label="Sign-in method" className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1">
      {(
        [
          ["email", "Email", Mail],
          ["phone", "Mobile number", Smartphone],
        ] as const
      ).map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors",
            value === key ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
}

export function PhoneAuthForm({ mode }: { mode: PhoneMode }) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [step, setStep] = useState<"number" | "code">("number");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; code?: string }>({});
  const [error, setError] = useState<ApiError | null>(null);

  const send = useMutation({
    mutationFn: () => sendPhoneOtp({ phone, mode, name: mode === "signup" ? name.trim() : undefined }),
    onSuccess: (data) => {
      setSentTo(data.phone);
      setStep("code");
      setCode("");
      setError(null);
    },
    onError: (err) => setError(readError(err, "Couldn't send the code")),
  });

  const verify = useMutation({
    mutationFn: () => verifyPhoneOtp({ phone, mode, code: code.trim() }),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      // New members land on settings so they can finish their profile.
      router.push(mode === "signup" ? "/settings" : "/dashboard");
    },
    onError: (err) => setError(readError(err, "Couldn't verify the code")),
  });

  const submitNumber = () => {
    const found = {
      name: mode === "signup" && !name.trim() ? "Name is required" : undefined,
      phone: !phone.trim() ? "Mobile number is required" : !looksLikePhone(phone) ? "Enter a 10-digit mobile number" : undefined,
    };
    setFieldErrors(found);
    setError(null);
    if (!found.name && !found.phone) send.mutate();
  };

  const submitCode = () => {
    const bad = !/^\d{6}$/.test(code.trim());
    setFieldErrors({ code: bad ? "Enter the 6-digit code" : undefined });
    setError(null);
    if (!bad) verify.mutate();
  };

  if (step === "code") {
    return (
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submitCode();
        }}
      >
        <p className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            We sent a 6-digit code by SMS to <span className="font-semibold">{sentTo}</span>.
            <button type="button" onClick={() => setStep("number")} className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
              <Pencil className="h-3 w-3" /> Change number
            </button>
          </span>
        </p>
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
            aria-invalid={fieldErrors.code ? true : undefined}
            aria-describedby="otp-error"
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
          />
          <FieldError id="otp-error" message={fieldErrors.code} />
        </div>
        <FormAlert message={error?.message ?? null} />
        <Button type="submit" disabled={verify.isPending} className="uppercase tracking-wider">
          {verify.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signup" ? "Verify & create account" : "Verify & log in"}
        </Button>
        <ResendCodeButton channel="sms" startCoolingDown onResend={() => sendPhoneOtp({ phone, mode, name: mode === "signup" ? name.trim() : undefined })} />
      </form>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submitNumber();
      }}
    >
      {mode === "signup" && (
        <div>
          <label htmlFor="phone-name" className="mb-1.5 block text-sm font-medium">
            Full name
          </label>
          <Input
            id="phone-name"
            autoComplete="name"
            placeholder="Full name"
            value={name}
            maxLength={80}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby="phone-name-error"
            onChange={(e) => setName(e.target.value)}
          />
          <FieldError id="phone-name-error" message={fieldErrors.name} />
        </div>
      )}
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
          Mobile number
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted">+91</span>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98765 43210"
            className="pl-12"
            value={phone}
            aria-invalid={fieldErrors.phone || error?.code === "USER_NOT_FOUND" ? true : undefined}
            aria-describedby="phone-error"
            onChange={(e) => {
              setPhone(e.target.value);
              setError(null);
            }}
          />
        </div>
        <FieldError id="phone-error" message={fieldErrors.phone} />
      </div>
      <FormAlert message={error?.message ?? null} />
      <Button type="submit" disabled={send.isPending} className="uppercase tracking-wider">
        {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send code
      </Button>
      <p className="text-xs text-muted">We&apos;ll text you a one-time code. Standard SMS rates may apply.</p>
    </form>
  );
}
