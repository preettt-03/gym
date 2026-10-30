"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { AuthShell } from "@/components/auth-shell";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => requestPasswordReset(values.email),
    onSuccess: (_data, values) => {
      router.push(`/reset-password?email=${encodeURIComponent(values.email)}&sent=1`);
    },
  });

  const serverError = mutation.isError
    ? isAxiosError(mutation.error)
      ? mutation.error.response?.data?.error?.message ?? "Something went wrong. Please try again."
      : "Something went wrong. Please try again."
    : null;

  return (
    <AuthShell title="Forgot password?" subtitle="Enter your email and we'll send you a 6-digit reset code.">
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby="email-error"
            {...register("email")}
          />
          <FieldError id="email-error" message={errors.email?.message} />
        </div>

        <FormAlert message={serverError} />

        <Button type="submit" disabled={mutation.isPending} className="mt-2 uppercase tracking-wider">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Sending code..." : "Send reset code"}
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted">
        Signed up with a mobile number? Choose <span className="font-semibold text-foreground">“Log in with a one-time code”</span> on the log-in page — we&apos;ll text you a code instead.
      </p>

      <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Back to log in
      </Link>
    </AuthShell>
  );
}
