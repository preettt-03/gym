"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { verifyEmail } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const schema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
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
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

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

  return (
    <Card className="w-full">
      <CardTitle>Verify your email</CardTitle>
      <CardDescription className="mt-1 mb-6">
        We sent a 6-digit code to <span className="text-foreground">{email || "your email"}</span>.
      </CardDescription>

      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values.code);
        })}
      >
        <div>
          <Input placeholder="000000" maxLength={6} {...register("code")} />
          {errors.code && <p className="mt-1 text-xs text-danger">{errors.code.message}</p>}
        </div>

        {serverError && <p className="text-sm text-danger">{serverError}</p>}

        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {mutation.isPending ? "Verifying..." : "Verify email"}
        </Button>
      </form>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <Suspense>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
