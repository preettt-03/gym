"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { verifyEmail } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { AuthShell } from "@/components/auth-shell";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

type FormValues = z.infer<typeof schema>;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  const mutation = useMutation({
    mutationFn: (code: string) => verifyEmail({ email, code }),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      router.push("/dashboard");
    },
    onError: (err) => {
      setServerError(
        isAxiosError(err) ? err.response?.data?.error?.message ?? "Verification failed" : "Verification failed"
      );
    },
  });

  const pending = isSubmitting || mutation.isPending;

  return (
    <>
      <p className="-mt-4 mb-6 text-sm text-muted">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email || "your email"}</span>.
      </p>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values.code);
        })}
      >
        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
            Verification code
          </label>
          <Input
            id="code"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="h-14 text-center font-display text-2xl tracking-[0.6em]"
            aria-invalid={errors.code ? true : undefined}
            aria-describedby="code-error"
            {...register("code", {
              // Keep the field digits-only, even for pasted codes like "123 456".
              onChange: (e) => {
                e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
                if (serverError) setServerError(null);
              },
            })}
          />
          <FieldError id="code-error" message={errors.code?.message} />
        </div>

        <FormAlert message={serverError} />

        <Button type="submit" disabled={pending} className="uppercase tracking-wider">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Verifying..." : "Verify email"}
        </Button>
      </form>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email" subtitle="One last step before you start training.">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-label="Loading">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        }
      >
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}
