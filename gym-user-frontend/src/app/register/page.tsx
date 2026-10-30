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
import { isEmailIdentifier, registerUser, sendPhoneOtp, verifyPhoneOtp } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldError, FormAlert, PasswordStrength } from "@/components/ui/form-message";
import { AuthShell } from "@/components/auth-shell";
import { GoogleSignInSection } from "@/components/google-sign-in-button";
import { CodeStep } from "@/components/code-step";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  // One box for both: an email gets a verification email, a mobile number an SMS code.
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email or mobile number")
    .refine(
      (v) => (isEmailIdentifier(v) ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : v.replace(/\D/g, "").length >= 10),
      "Enter a valid email or 10-digit mobile number"
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  // Set once an SMS code has gone out for a mobile sign-up.
  const [pendingPhone, setPendingPhone] = useState<{ values: FormValues; sentTo: string; devCode?: string } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { password: "" } });
  const password = useWatch({ control, name: "password" });

  const phoneSignup = (v: FormValues) => sendPhoneOtp({ phone: v.identifier, mode: "signup", name: v.name, password: v.password });

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      if (isEmailIdentifier(v.identifier)) {
        await registerUser({ email: v.identifier, password: v.password, name: v.name });
        return { kind: "email" as const, v };
      }
      const sent = await phoneSignup(v);
      return { kind: "phone" as const, v, sentTo: sent.phone, devCode: sent.devCode };
    },
    onSuccess: (r) => {
      if (r.kind === "email") router.push(`/verify-email?email=${encodeURIComponent(r.v.identifier)}&sent=1`);
      else setPendingPhone({ values: r.v, sentTo: r.sentTo, devCode: r.devCode });
    },
    onError: (err) => {
      setServerError(isAxiosError(err) ? err.response?.data?.error?.message ?? "Registration failed" : "Registration failed");
    },
  });

  const clearServerError = () => serverError && setServerError(null);
  const pending = isSubmitting || mutation.isPending;

  return (
    <AuthShell title="Create your account" subtitle="Start your fitness journey today.">
      {pendingPhone ? (
        <CodeStep
          channel="sms"
          sentTo={pendingPhone.sentTo}
          devCode={pendingPhone.devCode}
          submitLabel="Verify & create account"
          backLabel="Edit details"
          onBack={() => setPendingPhone(null)}
          onResend={() => phoneSignup(pendingPhone.values)}
          onVerify={async (code) => {
            const data = await verifyPhoneOtp({ phone: pendingPhone.values.identifier, mode: "signup", code });
            setSession(data.accessToken, data.user);
            // New members land on settings so they can finish their profile.
            router.push("/settings");
          }}
        />
      ) : (
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
            <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium">
              Email or mobile number
            </label>
            <Input
              id="identifier"
              autoComplete="username"
              placeholder="you@example.com or 98765 43210"
              aria-invalid={errors.identifier ? true : undefined}
              aria-describedby="identifier-error"
              {...register("identifier", { onChange: clearServerError })}
            />
            <FieldError id="identifier-error" message={errors.identifier?.message} />
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
          <p className="text-xs text-muted">We&apos;ll send a code to your email or mobile to confirm it&apos;s yours.</p>
        </form>
      )}

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
