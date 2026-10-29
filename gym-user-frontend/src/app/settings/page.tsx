"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import { Bell, BellOff, Camera, CheckCircle2, KeyRound, Loader2, Mail, Ruler, Trash2, User } from "lucide-react";
import { getMyProfile, removeProfilePhoto, updateMyProfile, uploadProfilePhoto, type UpdateProfileInput, type UserProfile } from "@/lib/profile-api";
import { Avatar } from "@/components/avatar";
import { getCurrentSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import { RequireAuth } from "@/components/require-auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldError } from "@/components/ui/form-message";
import { ErrorNote, MemberHeader, MemberPage, Panel } from "@/components/member/ui";
import { cn } from "@/lib/utils";

const PROFILE_KEY = ["my-profile"];

// Optional numeric field kept as text in the form; mirrors the API's limits.
const optionalNumber = (label: string, min: number, max: number, unit = "") =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || Number.isFinite(Number(v)), "Enter a number")
    .refine((v) => v === "" || (Number(v) >= min && Number(v) <= max), `${label} should be between ${min} and ${max}${unit}`);

const schema = z.object({
  name: z.string().trim().max(80, "Name is too long"),
  age: optionalNumber("Age", 10, 100),
  gender: z.string(),
  heightCm: optionalNumber("Height", 100, 250, " cm"),
  weightKg: optionalNumber("Weight", 25, 300, " kg"),
  targetWeightKg: optionalNumber("Target weight", 25, 300, " kg"),
  fitnessGoal: z.string(),
  experienceLevel: z.string(),
  activityLevel: z.string(),
  gymName: z.string().trim().max(80, "Too long"),
});
type FormValues = z.infer<typeof schema>;

function toProfileInput(v: FormValues): UpdateProfileInput {
  const num = (s: string) => (s ? Number(s) : undefined);
  return {
    name: v.name || undefined,
    age: v.age ? Math.round(Number(v.age)) : undefined,
    gender: (v.gender || undefined) as UpdateProfileInput["gender"],
    heightCm: num(v.heightCm),
    weightKg: num(v.weightKg),
    targetWeightKg: num(v.targetWeightKg),
    fitnessGoal: (v.fitnessGoal || undefined) as UpdateProfileInput["fitnessGoal"],
    experienceLevel: (v.experienceLevel || undefined) as UpdateProfileInput["experienceLevel"],
    activityLevel: (v.activityLevel || undefined) as UpdateProfileInput["activityLevel"],
    gymName: v.gymName || undefined,
  };
}

const OPTIONS = {
  gender: [
    ["MALE", "Male"],
    ["FEMALE", "Female"],
    ["OTHER", "Other / prefer not to say"],
  ],
  fitnessGoal: [
    ["WEIGHT_LOSS", "Weight loss"],
    ["MUSCLE_GAIN", "Muscle gain"],
    ["MAINTENANCE", "Maintenance"],
    ["ENDURANCE", "Endurance"],
    ["GENERAL_FITNESS", "General fitness"],
  ],
  experienceLevel: [
    ["BEGINNER", "Beginner"],
    ["INTERMEDIATE", "Intermediate"],
    ["ADVANCED", "Advanced"],
  ],
  activityLevel: [
    ["SEDENTARY", "Sedentary — desk job, little exercise"],
    ["LIGHTLY_ACTIVE", "Lightly active — 1–3 workouts / week"],
    ["MODERATELY_ACTIVE", "Moderately active — 3–5 workouts / week"],
    ["VERY_ACTIVE", "Very active — 6–7 workouts / week"],
    ["EXTRA_ACTIVE", "Extra active — physical job + training"],
  ],
} as const;

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
      {hint && !error && <p className="pt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// Push state comes from the browser, so it's read through a query rather
// than set inside an effect.
function PushNotificationsPanel() {
  const queryClient = useQueryClient();
  const supported = typeof window !== "undefined" && isPushSupported();
  const status = useQuery({
    queryKey: ["push-subscription"],
    queryFn: async () => Boolean(await getCurrentSubscription()),
    enabled: supported,
  });
  const toggle = useMutation({
    mutationFn: async () => {
      if (status.data) {
        await unsubscribeFromPush();
        return false;
      }
      const result = await subscribeToPush();
      if (!result.ok) throw new Error(result.reason ?? "Could not enable notifications.");
      return true;
    },
    onSuccess: (on) => queryClient.setQueryData(["push-subscription"], on),
  });
  const on = Boolean(status.data);

  return (
    <Panel icon={on ? Bell : BellOff} title="Notifications">
      <p className="text-sm text-muted">Workout and diet reminders, membership alerts and messages from your trainer — even when the app is closed.</p>
      {!supported ? (
        <p className="mt-4 text-sm text-muted">This browser doesn&apos;t support push notifications. Try Chrome, Edge or the installed app.</p>
      ) : status.isPending ? (
        <Skeleton className="mt-4 h-10 w-48 rounded-xl" />
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={cn("rounded-full px-3 py-1 text-xs", on ? "bg-success/10 text-success" : "bg-surface-2 text-muted")}>{on ? "On for this device" : "Off"}</span>
          <Button variant={on ? "glass" : "default"} size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
            {toggle.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {on ? "Turn off" : "Turn on"} push notifications
          </Button>
        </div>
      )}
      {toggle.isError && (
        <div className="mt-3">
          <ErrorNote>{toggle.error instanceof Error ? toggle.error.message : "Could not change notifications."}</ErrorNote>
        </div>
      )}
    </Panel>
  );
}

// Mirrors the server's upload rules so bad files fail fast in the browser.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// Saved the moment a file is picked — separate from the form's Save button.
function ProfilePhoto({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onSaved = (user: UserProfile) => {
    queryClient.setQueryData<UserProfile>(PROFILE_KEY, (old) => (old ? { ...old, photoUrl: user.photoUrl } : user));
    if (fileRef.current) fileRef.current.value = "";
  };
  const onFailed = (err: unknown) =>
    setError(isAxiosError(err) ? err.response?.data?.error?.message ?? "Couldn't update your photo" : "Couldn't update your photo");

  const upload = useMutation({ mutationFn: uploadProfilePhoto, onSuccess: onSaved, onError: onFailed });
  const remove = useMutation({ mutationFn: removeProfilePhoto, onSuccess: onSaved, onError: onFailed });
  const busy = upload.isPending || remove.isPending;

  const pick = (file?: File) => {
    setError(null);
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setError("Use a JPG, PNG or WebP image.");
    if (file.size > PHOTO_MAX_BYTES) return setError("That photo is over 5 MB — try a smaller one.");
    upload.mutate(file);
  };

  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
      <div className="relative w-fit">
        <Avatar photoUrl={profile.photoUrl} name={profile.name} email={profile.email} size="lg" className="ring-2 ring-gold/30" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold">Profile photo</p>
        <p className="mt-0.5 text-xs text-muted">Shown on your account and next to your chat messages. JPG, PNG or WebP, up to 5 MB.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept={PHOTO_TYPES.join(",")} className="hidden" aria-label="Choose profile photo" onChange={(e) => pick(e.target.files?.[0])} />
          <Button type="button" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" /> {profile.photoUrl ? "Change photo" : "Add photo"}
          </Button>
          {profile.photoUrl && (
            <Button type="button" size="sm" variant="glass" disabled={busy} onClick={() => remove.mutate()}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function SettingsContent() {
  const queryClient = useQueryClient();
  const { data: profile, isPending } = useQuery({ queryKey: PROFILE_KEY, queryFn: getMyProfile });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  useEffect(() => {
    if (!profile) return;
    reset({
      name: profile.name ?? "",
      age: profile.age?.toString() ?? "",
      gender: profile.gender ?? "",
      heightCm: profile.heightCm?.toString() ?? "",
      weightKg: profile.weightKg?.toString() ?? "",
      targetWeightKg: profile.targetWeightKg?.toString() ?? "",
      fitnessGoal: profile.fitnessGoal ?? "",
      experienceLevel: profile.experienceLevel ?? "",
      activityLevel: profile.activityLevel ?? "",
      gymName: profile.gymName ?? "",
    });
  }, [profile, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) => updateMyProfile(toProfileInput(values)),
    onSuccess: (_d, values) => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      reset(values);
    },
  });

  const fieldProps = (name: keyof FormValues) => ({
    id: name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": `${name}-error`,
    ...register(name),
  });

  const select = (name: keyof typeof OPTIONS, placeholder: string) => (
    <FormSelect
      control={control}
      name={name}
      id={name}
      aria-describedby={`${name}-error`}
      placeholder={placeholder}
      options={[{ value: "", label: placeholder }, ...OPTIONS[name].map(([value, label]) => ({ value, label }))]}
    />
  );

  return (
    <MemberPage className="max-w-4xl">
      <MemberHeader eyebrow="Account" title="Settings" description="Your profile powers the BMI, calorie and AI coach recommendations across the app." />

      {isPending ? (
        <Skeleton className="mt-8 h-96 rounded-2xl" />
      ) : (
        <form
          noValidate
          className="mt-8 flex flex-col gap-4"
          onSubmit={handleSubmit((values) => save.mutate(values))}
        >
          <Panel icon={User} title="About you">
            {profile && <ProfilePhoto profile={profile} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="name" label="Name" error={errors.name?.message}>
                <Input autoComplete="name" placeholder="Name" {...fieldProps("name")} />
              </Field>
              <Field id="age" label="Age" error={errors.age?.message}>
                <Input inputMode="numeric" placeholder="Age" {...fieldProps("age")} />
              </Field>
              <Field id="gender" label="Sex" hint="Used only for calorie and body-fat formulas.">
                {select("gender", "Select")}
              </Field>
              <Field id="gymName" label="Home gym" error={errors.gymName?.message}>
                <Input placeholder="Gym name" {...fieldProps("gymName")} />
              </Field>
            </div>
          </Panel>

          <Panel icon={Ruler} title="Body & goals">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="heightCm" label="Height (cm)" error={errors.heightCm?.message}>
                <Input inputMode="decimal" placeholder="e.g. 172" {...fieldProps("heightCm")} />
              </Field>
              <Field id="weightKg" label="Weight (kg)" error={errors.weightKg?.message}>
                <Input inputMode="decimal" placeholder="e.g. 74.5" {...fieldProps("weightKg")} />
              </Field>
              <Field id="targetWeightKg" label="Target weight (kg)" error={errors.targetWeightKg?.message}>
                <Input inputMode="decimal" placeholder="e.g. 70" {...fieldProps("targetWeightKg")} />
              </Field>
              <Field id="fitnessGoal" label="Main goal">
                {select("fitnessGoal", "Select a goal")}
              </Field>
              <Field id="experienceLevel" label="Experience">
                {select("experienceLevel", "Select a level")}
              </Field>
              <Field id="activityLevel" label="Activity level">
                {select("activityLevel", "Select")}
              </Field>
            </div>
          </Panel>

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/90 px-5 py-3 backdrop-blur-md">
            <span className="text-sm text-muted" aria-live="polite">
              {save.isSuccess && !isDirty ? (
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="h-4 w-4" /> Saved
                </span>
              ) : save.isError ? (
                <span className="text-danger">
                  {isAxiosError(save.error) ? save.error.response?.data?.error?.message ?? "Could not save" : "Could not save"}
                </span>
              ) : isDirty ? (
                "You have unsaved changes"
              ) : (
                "All changes saved"
              )}
            </span>
            <Button type="submit" disabled={!isDirty || save.isPending} className="uppercase tracking-wider">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <PushNotificationsPanel />
        <Panel icon={KeyRound} title="Sign-in & security">
          <p className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-gold" /> {profile?.email ?? "—"}
          </p>
          <p className="mt-3 text-sm text-muted">To change your password we&apos;ll email you a reset code. You&apos;ll be signed out on every device.</p>
          <Link
            href="/forgot-password"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
          >
            Change password
          </Link>
        </Panel>
      </div>
    </MemberPage>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}
