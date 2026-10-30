"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import { BadgeCheck, Bell, BellOff, Camera, CheckCircle2, HeartPulse, KeyRound, Loader2, Mail, MapPin, Ruler, ShieldCheck, Smartphone, Trash2, User } from "lucide-react";
import { BLOOD_GROUPS, getMyProfile, removeMyPhone, removeProfilePhoto, updateMyProfile, uploadProfilePhoto, type UpdateProfileInput, type UserProfile } from "@/lib/profile-api";
import { ChipsInput } from "@/components/member/chips-input";
import { ContactDialog } from "@/components/member/contact-dialog";
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
  dateOfBirth: z.string(),
  bloodGroup: z.string(),
  alternatePhone: z
    .string()
    .trim()
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Enter a 10-digit mobile number"),
  addressLine1: z.string().trim().max(120, "Too long"),
  addressLine2: z.string().trim().max(120, "Too long"),
  city: z.string().trim().max(60, "Too long"),
  state: z.string().trim().max(60, "Too long"),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[A-Za-z0-9 -]{3,10}$/.test(v), "Enter a valid PIN code"),
  country: z.string().trim().max(60, "Too long"),
  medicalConditions: z.array(z.string()),
  allergies: z.array(z.string()),
  injuries: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;

function toProfileInput(v: FormValues): UpdateProfileInput {
  const num = (s: string) => (s ? Number(s) : undefined);
  // Empty optional details are sent as null so clearing a field actually clears it.
  const text = (s: string) => s.trim() || null;
  return {
    name: v.name || undefined,
    // With a date of birth the server keeps age up to date itself.
    age: !v.dateOfBirth && v.age ? Math.round(Number(v.age)) : undefined,
    dateOfBirth: v.dateOfBirth || null,
    bloodGroup: v.bloodGroup || null,
    alternatePhone: text(v.alternatePhone),
    addressLine1: text(v.addressLine1),
    addressLine2: text(v.addressLine2),
    city: text(v.city),
    state: text(v.state),
    postalCode: text(v.postalCode),
    country: text(v.country),
    medicalConditions: v.medicalConditions,
    allergies: v.allergies,
    injuries: v.injuries,
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

const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

function ageFrom(dob: string) {
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

function Verified({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success">
      <BadgeCheck className="h-3 w-3" /> Verified
    </span>
  ) : (
    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">Not verified</span>
  );
}

// Email, mobile and Google — every way the member can sign in, each changed through a code.
function SignInPanel({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"email" | "phone" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = useMutation({
    mutationFn: removeMyPhone,
    onSuccess: (user) => {
      queryClient.setQueryData(PROFILE_KEY, user);
      setConfirmRemove(false);
    },
  });
  const canRemovePhone = Boolean(profile.email || profile.hasGoogle);

  const row = (icon: React.ReactNode, label: string, value: string | null, verified: boolean, kind: "email" | "phone") => (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{label}</p>
        <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium">
          {value ?? <span className="font-normal text-muted">Not added</span>}
          {value && <Verified ok={verified} />}
        </p>
      </div>
      <Button size="sm" variant="glass" onClick={() => setDialog(kind)}>
        {value ? "Change" : "Add"}
      </Button>
    </li>
  );

  return (
    <Panel icon={KeyRound} title="Sign-in & contact">
      <ul className="divide-y divide-border">
        {row(<Mail className="h-4 w-4" />, "Email", profile.email, profile.isEmailVerified, "email")}
        {row(<Smartphone className="h-4 w-4" />, "Mobile number", profile.phone, profile.isPhoneVerified, "phone")}
        {profile.hasGoogle && (
          <li className="flex items-center gap-3 py-3 text-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 font-bold text-gold">G</span>
            <span className="flex-1">Google account linked</span>
            <Verified ok />
          </li>
        )}
      </ul>
      {profile.phone && canRemovePhone && (
        <div className="mt-1 text-xs">
          {confirmRemove ? (
            <span className="flex flex-wrap items-center gap-2">
              Remove this number? You won&apos;t be able to log in with it.
              <Button size="sm" variant="destructive" className="h-7" disabled={remove.isPending} onClick={() => remove.mutate()}>
                Remove
              </Button>
              <Button size="sm" variant="glass" className="h-7" onClick={() => setConfirmRemove(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} className="text-muted hover:text-danger">
              Remove mobile number
            </button>
          )}
        </div>
      )}
      {profile.email && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm text-muted">To change your password we&apos;ll email you a reset code. You&apos;ll be signed out on every device.</p>
          <Link href="/forgot-password" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>
            Change password
          </Link>
        </div>
      )}
      {dialog && <ContactDialog kind={dialog} current={dialog === "email" ? profile.email : profile.phone} onClose={() => setDialog(null)} />}
    </Panel>
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
      dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? "",
      bloodGroup: profile.bloodGroup ?? "",
      alternatePhone: profile.alternatePhone ?? "",
      addressLine1: profile.addressLine1 ?? "",
      addressLine2: profile.addressLine2 ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      postalCode: profile.postalCode ?? "",
      country: profile.country ?? "India",
      medicalConditions: profile.medicalConditions ?? [],
      allergies: profile.allergies ?? [],
      injuries: profile.injuries ?? [],
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

  const dateOfBirth = useWatch({ control, name: "dateOfBirth" });
  const chips = (name: "medicalConditions" | "allergies" | "injuries", placeholder: string, suggestions: string[]) => (
    <Controller control={control} name={name} render={({ field }) => <ChipsInput id={name} value={field.value ?? []} onChange={field.onChange} placeholder={placeholder} suggestions={suggestions} />} />
  );

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
              <Field id="dateOfBirth" label="Date of birth" hint={dateOfBirth ? `Age ${ageFrom(dateOfBirth)} — updates automatically.` : undefined}>
                <Input type="date" min={yearsAgo(100)} max={yearsAgo(10)} {...fieldProps("dateOfBirth")} />
              </Field>
              {!dateOfBirth && (
                <Field id="age" label="Age" error={errors.age?.message} hint="Or add your date of birth instead.">
                  <Input inputMode="numeric" placeholder="Age" {...fieldProps("age")} />
                </Field>
              )}
              <Field id="gender" label="Sex" hint="Used only for calorie and body-fat formulas.">
                {select("gender", "Select")}
              </Field>
              <Field id="bloodGroup" label="Blood group" hint="Useful to staff in an emergency.">
                <FormSelect
                  control={control}
                  name="bloodGroup"
                  id="bloodGroup"
                  placeholder="Select"
                  options={[{ value: "", label: "Not set" }, ...BLOOD_GROUPS.map((g) => ({ value: g, label: g }))]}
                />
              </Field>
              <Field id="alternatePhone" label="Alternate mobile" error={errors.alternatePhone?.message} hint="A second number we can reach you on.">
                <Input type="tel" inputMode="tel" placeholder="98765 43210" {...fieldProps("alternatePhone")} />
              </Field>
              <Field id="gymName" label="Home gym" error={errors.gymName?.message}>
                <Input placeholder="Gym name" {...fieldProps("gymName")} />
              </Field>
            </div>
          </Panel>

          <Panel icon={MapPin} title="Address">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="addressLine1" label="House / flat, street" error={errors.addressLine1?.message}>
                <Input autoComplete="address-line1" placeholder="e.g. 12, MG Road" {...fieldProps("addressLine1")} />
              </Field>
              <Field id="addressLine2" label="Area / landmark" error={errors.addressLine2?.message}>
                <Input autoComplete="address-line2" placeholder="e.g. Near Hanuman Mandir" {...fieldProps("addressLine2")} />
              </Field>
              <Field id="city" label="City / town" error={errors.city?.message}>
                <Input autoComplete="address-level2" placeholder="e.g. Fatehabad" {...fieldProps("city")} />
              </Field>
              <Field id="state" label="State" error={errors.state?.message}>
                <Input autoComplete="address-level1" placeholder="e.g. Madhya Pradesh" {...fieldProps("state")} />
              </Field>
              <Field id="postalCode" label="PIN code" error={errors.postalCode?.message}>
                <Input autoComplete="postal-code" inputMode="numeric" placeholder="e.g. 453551" {...fieldProps("postalCode")} />
              </Field>
              <Field id="country" label="Country" error={errors.country?.message}>
                <Input autoComplete="country-name" {...fieldProps("country")} />
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

          <Panel icon={HeartPulse} title="Health">
            <p className="-mt-1 mb-4 flex items-start gap-2 text-xs text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              Private. Shared only with your trainer and, when needed, gym staff — so workouts and diet plans stay safe for you.
            </p>
            <div className="grid gap-4">
              <Field id="medicalConditions" label="Medical conditions">
                {chips("medicalConditions", "e.g. Asthma — press Enter to add", ["Asthma", "Diabetes", "High blood pressure", "Thyroid", "PCOS", "Heart condition"])}
              </Field>
              <Field id="injuries" label="Injuries / health issues">
                {chips("injuries", "e.g. Lower back pain", ["Lower back pain", "Knee pain", "Shoulder injury", "Slip disc", "Neck pain"])}
              </Field>
              <Field id="allergies" label="Allergies">
                {chips("allergies", "e.g. Peanuts", ["Peanuts", "Lactose", "Gluten", "Shellfish", "Eggs"])}
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
        {profile && <SignInPanel profile={profile} />}
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
