"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { loginUser } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { AuthShell } from "@/components/auth-shell";
import { GoogleSignInSection } from "@/components/google-sign-in-button";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const UNVERIFIED = "Email not verified";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  const mutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      router.push("/dashboard");
    },
    onError: (err) => {
      setServerError(isAxiosError(err) ? err.response?.data?.error?.message ?? "Login failed" : "Login failed");
    },
  });

  // Typing again means the last server error no longer applies.
  const clearServerError = () => serverError && setServerError(null);
  const pending = isSubmitting || mutation.isPending;

  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your journey.">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => {
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

        <FormAlert message={serverError} />
        {serverError === UNVERIFIED && (
          <Link
            href={`/verify-email?email=${encodeURIComponent(getValues("email"))}`}
            className="-mt-1 text-sm font-semibold text-gold hover:underline"
          >
            Verify your email now →
          </Link>
        )}

        <Button type="submit" disabled={pending} className="mt-2 uppercase tracking-wider">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <GoogleSignInSection onError={setServerError} />

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-gold hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
