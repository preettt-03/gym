"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CheckCircle2, KeyRound, Loader2, Lock, MessageSquareText } from "lucide-react";
import { isEmailIdentifier, loginUser, sendLoginOtp, verifyLoginOtp, type CodeSent } from "@/lib/api";
import { clearLoginLock, getLoginLockSnapshot, lockLogin, parseLoginLock, recordLoginFailure, subscribeLoginLock } from "@/lib/login-lock";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { AuthShell } from "@/components/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { GoogleSignInSection } from "@/components/google-sign-in-button";
import { CodeStep } from "@/components/code-step";

type LoginError = { message: string; code?: string; retryAfterSeconds?: number };

function readLoginError(err: unknown): LoginError {
  if (!isAxiosError(err)) return { message: "Login failed" };
  if (!err.response) return { message: "Can't reach the server. Check your connection and try again." };
  const error = err.response.data?.error;
  return { message: error?.message ?? "Login failed", code: error?.details?.code, retryAfterSeconds: error?.details?.retryAfterSeconds };
}

// Ticks once a second while a lock is active; returns whole seconds left.
function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    // Tick right away too — `now` may be stale from when the page loaded.
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

// Light client check; the server decides what the identifier really is.
function identifierError(value: string) {
  const v = value.trim();
  if (!v) return "Enter your email or mobile number";
  if (isEmailIdentifier(v)) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? undefined : "Enter a valid email address";
  return v.replace(/\D/g, "").length >= 10 ? undefined : "Enter a valid email or 10-digit mobile number";
}

function LoginForm() {
  const router = useRouter();
  const justReset = useSearchParams().get("reset") === "1";
  const setSession = useAuthStore((s) => s.setSession);
  const [mode, setMode] = useState<"password" | "code">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [serverError, setServerError] = useState<LoginError | null>(null);
  const [codeSent, setCodeSent] = useState<CodeSent | null>(null);
  const lockRaw = useSyncExternalStore(subscribeLoginLock, getLoginLockSnapshot, () => null);
  const lockSeconds = useCountdown(parseLoginLock(lockRaw).until || null);
  const locked = lockSeconds > 0;

  const signedIn = (data: { accessToken: string; user: Parameters<typeof setSession>[1] }) => {
    clearLoginLock();
    setSession(data.accessToken, data.user);
    router.push("/dashboard");
  };

  const login = useMutation({
    mutationFn: () => loginUser({ identifier: identifier.trim(), password }),
    onSuccess: signedIn,
    onError: (err) => {
      const error = readLoginError(err);
      if (error.code === "LOGIN_LOCKED") {
        lockLogin(error.retryAfterSeconds ?? 30);
        return setServerError(null);
      }
      if ((error.code === "USER_NOT_FOUND" || error.code === "WRONG_PASSWORD") && recordLoginFailure()) {
        // The countdown takes over the message slot.
        return setServerError(null);
      }
      setServerError(error);
    },
  });

  const sendCode = useMutation({
    mutationFn: () => sendLoginOtp(identifier.trim()),
    onSuccess: (data) => {
      setCodeSent(data);
      setServerError(null);
    },
    onError: (err) => setServerError(readLoginError(err)),
  });

  const switchMode = (next: "password" | "code") => {
    setMode(next);
    setServerError(null);
    setFieldErrors({});
    setCodeSent(null);
  };

  // Typing again means the last server error no longer applies.
  const clearServerError = () => serverError && setServerError(null);
  const alert = locked ? `Too many failed attempts. Try again in ${lockSeconds} second${lockSeconds === 1 ? "" : "s"}.` : serverError?.message ?? null;

  if (mode === "code" && codeSent) {
    return (
      <CodeStep
        channel={codeSent.channel}
        sentTo={codeSent.sentTo}
        devCode={codeSent.devCode}
        submitLabel="Verify & log in"
        backLabel="Change"
        onBack={() => setCodeSent(null)}
        onResend={() => sendLoginOtp(identifier.trim())}
        onVerify={async (code) => signedIn(await verifyLoginOtp(identifier.trim(), code))}
      />
    );
  }

  return (
    <>
      {justReset && !serverError && (
        <p role="status" className="mb-6 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Password updated. Log in with your new password.
        </p>
      )}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setServerError(null);
          const found = { identifier: identifierError(identifier), password: mode === "password" && !password ? "Password is required" : undefined };
          setFieldErrors(found);
          if (found.identifier || found.password) return;
          if (mode === "code") return sendCode.mutate();
          if (!locked) login.mutate();
        }}
      >
        <div>
          <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium">
            Email or mobile number
          </label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder="you@example.com or 98765 43210"
            value={identifier}
            aria-invalid={fieldErrors.identifier || serverError?.code === "USER_NOT_FOUND" ? true : undefined}
            aria-describedby="identifier-error"
            onChange={(e) => {
              setIdentifier(e.target.value);
              clearServerError();
            }}
          />
          <FieldError id="identifier-error" message={fieldErrors.identifier} />
        </div>

        {mode === "password" && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-semibold text-gold hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              aria-invalid={fieldErrors.password || serverError?.code === "WRONG_PASSWORD" ? true : undefined}
              aria-describedby="password-error"
              onChange={(e) => {
                setPassword(e.target.value);
                clearServerError();
              }}
            />
            <FieldError id="password-error" message={fieldErrors.password} />
          </div>
        )}

        <FormAlert message={alert} />
        {serverError?.code === "EMAIL_NOT_VERIFIED" && (
          <Link href={`/verify-email?email=${encodeURIComponent(identifier.trim())}`} className="-mt-1 text-sm font-semibold text-gold hover:underline">
            Verify your email now →
          </Link>
        )}
        {serverError?.code === "NO_PASSWORD" && (
          <button type="button" onClick={() => switchMode("code")} className="-mt-1 text-left text-sm font-semibold text-gold hover:underline">
            Get a one-time code →
          </button>
        )}

        {mode === "password" ? (
          <Button type="submit" disabled={login.isPending || locked} className="mt-1 uppercase tracking-wider">
            {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {locked && <Lock className="h-4 w-4" />}
            {login.isPending ? "Logging in..." : locked ? `Try again in ${lockSeconds}s` : "Log in"}
          </Button>
        ) : (
          <Button type="submit" disabled={sendCode.isPending} className="mt-1 uppercase tracking-wider">
            {sendCode.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send login code
          </Button>
        )}

      </form>

      <button
        type="button"
        onClick={() => switchMode(mode === "password" ? "code" : "password")}
        className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-medium text-muted hover:text-gold"
      >
        {mode === "password" ? <MessageSquareText className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
        {mode === "password" ? "Log in with a one-time code instead" : "Use my password instead"}
      </button>

      <GoogleSignInSection onError={(message) => setServerError({ message })} />

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-gold hover:underline">
          Sign up
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your journey.">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-label="Loading">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
