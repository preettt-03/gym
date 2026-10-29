import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { loginAdmin } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import logo from "@/assets/logo.png";
import authSide from "@/assets/auth-side.jpg";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

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

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const lockSeconds = useCountdown(lockedUntil);
  const locked = lockSeconds > 0;
  const reduceMotion = useReducedMotion();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  const mutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: (data) => {
      if (data.user.role !== "ADMIN") {
        setServerError("This account does not have admin access.");
        return;
      }
      setSession(data.accessToken, data.user);
      navigate("/");
    },
    onError: (err) => {
      if (isAxiosError(err) && !err.response) return setServerError("Can't reach the server. Check that the backend is running.");
      const error = isAxiosError(err) ? err.response?.data?.error : undefined;
      // The countdown replaces the message, so nothing stale is left once it ends.
      if (error?.details?.code === "LOGIN_LOCKED") return setLockedUntil(Date.now() + error.details.retryAfterSeconds * 1000);
      setServerError(error?.message ?? "Login failed");
    },
  });

  // Typing again means the last server error no longer applies.
  const clearServerError = () => serverError && setServerError(null);
  const pending = isSubmitting || mutation.isPending;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative isolate hidden overflow-hidden lg:block">
        <img src={authSide} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/50 to-background/10" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <img src={logo} alt="" className="h-20 w-20" />
          <p className="mt-6 max-w-md font-display text-4xl font-bold uppercase leading-tight">
            Run your gym like a <span className="text-gold">king.</span>
          </p>
          <p className="mt-4 text-sm uppercase tracking-[0.3em] text-gold">Lift · Love · Repeat</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-14 sm:px-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <img src={logo} alt="King's Fitness" className="mb-8 h-16 w-16 lg:hidden" />
          <p className="eyebrow">King&apos;s Fitness</p>
          <h1 className="mt-4 text-4xl font-bold uppercase">Admin panel</h1>
          <p className="mt-2 text-muted">Sign in with your admin account.</p>

          <form
            noValidate
            className="mt-8 flex flex-col gap-4"
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
                autoComplete="username"
                placeholder="Email"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby="email-error"
                {...register("email", { onChange: clearServerError })}
              />
              <FieldError id="email-error" message={errors.email?.message} />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="Password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby="password-error"
                {...register("password", { onChange: clearServerError })}
              />
              <FieldError id="password-error" message={errors.password?.message} />
            </div>

            <FormAlert message={locked ? `Too many wrong attempts. Try again in ${lockSeconds} second${lockSeconds === 1 ? "" : "s"}.` : serverError} />

            <Button type="submit" disabled={pending || locked} className="mt-2 uppercase tracking-wider">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {locked && <Lock className="h-4 w-4" />}
              {mutation.isPending ? "Signing in..." : locked ? `Try again in ${lockSeconds}s` : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-4 w-4 text-gold" /> Restricted area — admin accounts only.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
