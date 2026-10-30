"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { getAuthMethods, loginUser } from "@/lib/api";
import { MethodTabs, PhoneAuthForm } from "@/components/phone-auth-form";
import {
  clearLoginLock,
  getLoginLockSnapshot,
  lockLogin,
  parseLoginLock,
  recordLoginFailure,
  subscribeLoginLock,
} from "@/lib/login-lock";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { AuthShell } from "@/components/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { GoogleSignInSection } from "@/components/google-sign-in-button";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

type LoginError = {
  message: string;
  code?: string;
  retryAfterSeconds?: number;
};

function readLoginError(err: unknown): LoginError {
  if (!isAxiosError(err)) return { message: "Login failed" };
  if (!err.response)
    return {
      message: "Can't reach the server. Check your connection and try again.",
    };
  const error = err.response.data?.error;
  return {
    message: error?.message ?? "Login failed",
    code: error?.details?.code,
    retryAfterSeconds: error?.details?.retryAfterSeconds,
  };
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

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justReset = params.get("reset") === "1";
  const [method, setMethod] = useState<"email" | "phone">(
    params.get("method") === "phone" ? "phone" : "email",
  );
  const { data: methods } = useQuery({
    queryKey: ["auth-methods"],
    queryFn: getAuthMethods,
    staleTime: 5 * 60_000,
  });
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<LoginError | null>(null);
  const lockRaw = useSyncExternalStore(
    subscribeLoginLock,
    getLoginLockSnapshot,
    () => null,
  );
  const lockSeconds = useCountdown(parseLoginLock(lockRaw).until || null);
  const locked = lockSeconds > 0;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      clearLoginLock();
      setSession(data.accessToken, data.user);
      router.push("/dashboard");
    },
    onError: (err) => {
      const error = readLoginError(err);
      if (error.code === "LOGIN_LOCKED") {
        lockLogin(error.retryAfterSeconds ?? 30);
        return setServerError(null);
      }
      if (
        (error.code === "USER_NOT_FOUND" || error.code === "WRONG_PASSWORD") &&
        recordLoginFailure()
      ) {
        // The countdown takes over the message slot.
        return setServerError(null);
      }
      setServerError(error);
    },
  });

  // Typing again means the last server error no longer applies.
  const clearServerError = () => serverError && setServerError(null);
  const pending = isSubmitting || mutation.isPending;
  const alert = locked
    ? `Too many failed attempts. Try again in ${lockSeconds} second${lockSeconds === 1 ? "" : "s"}.`
    : (serverError?.message ?? null);

  return (
    <>
      {justReset && !serverError && (
        <p
          role="status"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Password updated. Log in with your new password.
        </p>
      )}
      {methods?.phone && <MethodTabs value={method} onChange={setMethod} />}
      {method === "phone" && methods?.phone ? (
        <PhoneAuthForm mode="login" />
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) => {
            if (locked) return;
            setServerError(null);
            mutation.mutate(values);
          })}
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              aria-invalid={
                errors.email || serverError?.code === "USER_NOT_FOUND"
                  ? true
                  : undefined
              }
              aria-describedby="email-error"
              {...register("email", { onChange: clearServerError })}
            />
            <FieldError id="email-error" message={errors.email?.message} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-gold hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Password"
              aria-invalid={
                errors.password || serverError?.code === "WRONG_PASSWORD"
                  ? true
                  : undefined
              }
              aria-describedby="password-error"
              {...register("password", { onChange: clearServerError })}
            />
            <FieldError
              id="password-error"
              message={errors.password?.message}
            />
          </div>

          <FormAlert message={alert} />
          {serverError?.code === "EMAIL_NOT_VERIFIED" && (
            <Link
              href={`/verify-email?email=${encodeURIComponent(getValues("email"))}`}
              className="-mt-1 text-sm font-semibold text-gold hover:underline"
            >
              Verify your email now →
            </Link>
          )}

          <Button
            type="submit"
            disabled={pending || locked}
            className="mt-2 uppercase tracking-wider"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {locked && <Lock className="h-4 w-4" />}
            {mutation.isPending
              ? "Logging in..."
              : locked
                ? `Try again in ${lockSeconds}s`
                : "Log in"}
          </Button>
        </form>
      )}

      <GoogleSignInSection onError={(message) => setServerError({ message })} />

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-gold hover:underline"
        >
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
