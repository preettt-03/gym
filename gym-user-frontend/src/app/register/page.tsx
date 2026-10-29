"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { registerUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldError, FormAlert, PasswordStrength } from "@/components/ui/form-message";
import { AuthShell } from "@/components/auth-shell";
import { GoogleSignInSection } from "@/components/google-sign-in-button";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { password: "" } });
  const password = useWatch({ control, name: "password" });

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (_data, variables) => {
      router.push(`/verify-email?email=${encodeURIComponent(variables.email)}&sent=1`);
    },
    onError: (err) => {
      setServerError(isAxiosError(err) ? err.response?.data?.error?.message ?? "Registration failed" : "Registration failed");
    },
  });

  const clearServerError = () => serverError && setServerError(null);
  const pending = isSubmitting || mutation.isPending;

  return (
    <AuthShell title="Create your account" subtitle="Start your fitness journey today.">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Full name
          </label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Full name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="name-error"
            {...register("name", { onChange: clearServerError })}
          />
          <FieldError id="name-error" message={errors.name?.message} />
        </div>
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
            autoComplete="new-password"
            placeholder="Password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby="password-error password-hint"
            {...register("password", { onChange: clearServerError })}
          />
          <FieldError id="password-error" message={errors.password?.message} />
          <div id="password-hint">
            {!password && <p className="pt-1.5 text-xs text-muted">At least 8 characters.</p>}
            {password && !errors.password && <PasswordStrength password={password} />}
          </div>
        </div>

        <FormAlert message={serverError} />

        <Button type="submit" disabled={pending} className="mt-2 uppercase tracking-wider">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <GoogleSignInSection onError={setServerError} />

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-gold hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
