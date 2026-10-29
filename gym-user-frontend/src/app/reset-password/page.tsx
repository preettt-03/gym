"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, Loader2 } from "lucide-react";
import { requestPasswordReset, resetPassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldError, FormAlert, PasswordStrength } from "@/components/ui/form-message";
import { AuthShell } from "@/components/auth-shell";
import { ResendCodeButton } from "@/components/resend-code-button";

const schema = z
  .object({
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: initialEmail, code: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = useWatch({ control, name: "newPassword" });

  const mutation = useMutation({
    mutationFn: ({ email, code, newPassword }: FormValues) => resetPassword({ email, code, newPassword }),
    onSuccess: () => router.push("/login?reset=1"),
    onError: (err) => {
      setServerError(isAxiosError(err) ? err.response?.data?.error?.message ?? "Reset failed" : "Reset failed");
    },
  });

  const clearServerError = () => serverError && setServerError(null);

  return (
    <>
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
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="email-error"
            {...register("email", { onChange: clearServerError })}
          />
          <FieldError id="email-error" message={errors.email?.message} />
        </div>
        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
            Reset code
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
              onChange: (e) => {
                e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
                clearServerError();
              },
            })}
          />
          <FieldError id="code-error" message={errors.code?.message} />
        </div>
        <div>
          <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium">
            New password
          </label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            aria-invalid={errors.newPassword ? true : undefined}
            aria-describedby="newPassword-error newPassword-hint"
            {...register("newPassword", { onChange: clearServerError })}
          />
          <FieldError id="newPassword-error" message={errors.newPassword?.message} />
          <div id="newPassword-hint">
            {!newPassword && <p className="pt-1.5 text-xs text-muted">At least 8 characters.</p>}
            {newPassword && !errors.newPassword && <PasswordStrength password={newPassword} />}
          </div>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium">
            Confirm new password
          </label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? true : undefined}
            aria-describedby="confirmPassword-error"
            {...register("confirmPassword", { onChange: clearServerError })}
          />
          <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
        </div>

        <FormAlert message={serverError} />

        <Button type="submit" disabled={mutation.isPending} className="mt-2 uppercase tracking-wider">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Updating password..." : "Update password"}
        </Button>
      </form>

      <div className="mt-6">
        <ResendCodeButton
          startCoolingDown={searchParams.get("sent") === "1"}
          onResend={() => requestPasswordReset(getValues("email") || initialEmail)}
        />
      </div>
      <p className="mt-4 text-xs text-muted">Resetting your password signs you out on every device.</p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Reset password" subtitle="Enter the code we emailed you and choose a new password.">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-label="Loading">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
      <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Back to log in
      </Link>
    </AuthShell>
  );
}
