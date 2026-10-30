"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Calculator, Info, Loader2, Ruler } from "lucide-react";
import { calculateBodyFat, type BodyFatGender, type BodyFatResult } from "@/lib/exercise-api";
import { getMyProfile } from "@/lib/profile-api";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";
import { ToolPage } from "@/components/tools/ui";

type Unit = "cm" | "in";
const IN_TO_CM = 2.54;

// Server-side limits in cm; the form converts inches before checking.
const LIMITS = { heightCm: [100, 250], neckCm: [20, 80], waistCm: [40, 200], hipCm: [50, 200] } as const;
const LABELS = { heightCm: "Height", neckCm: "Neck", waistCm: "Waist", hipCm: "Hip" } as const;
type Field = keyof typeof LIMITS;

function buildSchema(unit: Unit) {
  const factor = unit === "in" ? IN_TO_CM : 1;
  const measure = (field: Field, required: boolean) =>
    z
      .string()
      .trim()
      .refine((v) => !required || v !== "", `${LABELS[field]} is required`)
      .refine((v) => v === "" || Number.isFinite(Number(v)), "Enter a number")
      .transform((v) => (v === "" ? undefined : Number(v) * factor))
      .refine((v) => v === undefined || (v >= LIMITS[field][0] && v <= LIMITS[field][1]), {
        message: `${LABELS[field]} should be between ${+(LIMITS[field][0] / factor).toFixed(0)} and ${+(LIMITS[field][1] / factor).toFixed(0)} ${unit}`,
      });

  return z
    .object({
      gender: z.enum(["MALE", "FEMALE"]),
      heightCm: measure("heightCm", true),
      neckCm: measure("neckCm", true),
      waistCm: measure("waistCm", true),
      hipCm: measure("hipCm", false),
    })
    .refine((v) => v.gender === "MALE" || v.hipCm !== undefined, { path: ["hipCm"], message: "Hip is required for women" })
    .refine((v) => (v.waistCm ?? 0) + (v.gender === "FEMALE" ? (v.hipCm ?? 0) : 0) > (v.neckCm ?? 0), {
      path: ["waistCm"],
      message: "Waist should be larger than neck — please re-measure",
    });
}

type FormInput = z.input<ReturnType<typeof buildSchema>>;
type FormOutput = z.output<ReturnType<typeof buildSchema>>;

// Same ACE bands the API uses, for drawing the scale.
const BANDS: Record<BodyFatGender, { label: string; max: number }[]> = {
  MALE: [
    { label: "Essential", max: 5 },
    { label: "Athletic", max: 13 },
    { label: "Fitness", max: 17 },
    { label: "Average", max: 24 },
    { label: "Above average", max: 40 },
  ],
  FEMALE: [
    { label: "Essential", max: 13 },
    { label: "Athletic", max: 20 },
    { label: "Fitness", max: 24 },
    { label: "Average", max: 31 },
    { label: "Above average", max: 45 },
  ],
};

const HOW_TO: { field: Field; text: string }[] = [
  { field: "neckCm", text: "Just below the larynx (Adam's apple), tape sloping slightly down to the front." },
  { field: "waistCm", text: "Men: horizontally at the navel. Women: at the narrowest point of the waist." },
  { field: "hipCm", text: "Women only: around the widest part of the hips and buttocks." },
];

function Scale({ gender, value }: { gender: BodyFatGender; value: number }) {
  const bands = BANDS[gender];
  const top = bands.at(-1)!.max;
  const marker = Math.min(100, (value / top) * 100);
  const widths = bands.map((b, i) => ((b.max - (i ? bands[i - 1].max : 0)) / top) * 100);
  return (
    <div className="mt-6" aria-hidden="true">
      <div className="relative flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {bands.map((b, i) => (
          <span
            key={b.label}
            className="h-full"
            style={{ width: `${widths[i]}%`, background: `color-mix(in srgb, var(--gold) ${30 + i * 15}%, var(--surface-2))` }}
          />
        ))}
      </div>
      <div className="relative h-4">
        <span className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded bg-foreground" style={{ left: `${marker}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        {bands.map((b) => (
          <span key={b.label} className="text-center">{b.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function BodyFatCalculatorPage() {
  return <ToolPage slug="body-fat">{() => <BodyFatWorkspace />}</ToolPage>;
}

// The profile query is shared with ToolPage, so this reads the cached result.
function BodyFatWorkspace() {
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const [unit, setUnit] = useState<Unit>("cm");
  const [result, setResult] = useState<(BodyFatResult & { gender: BodyFatGender }) | null>(null);

  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile, enabled: isAuthed });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitted },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(buildSchema(unit)),
    mode: "onTouched",
    defaultValues: { gender: "MALE", heightCm: "", neckCm: "", waistCm: "", hipCm: "" },
  });
  const gender = useWatch({ control, name: "gender" });

  // Prefill from the member's profile once, without overwriting typed values.
  useEffect(() => {
    if (!profile) return;
    if (profile.gender === "MALE" || profile.gender === "FEMALE") setValue("gender", profile.gender);
    if (profile.heightCm && !getValues("heightCm")) setValue("heightCm", String(profile.heightCm));
  }, [profile, setValue, getValues]);

  const switchUnit = (next: Unit) => {
    if (next === unit) return;
    const factor = next === "in" ? 1 / IN_TO_CM : IN_TO_CM;
    (["heightCm", "neckCm", "waistCm", "hipCm"] as const).forEach((f) => {
      const v = Number(getValues(f));
      if (getValues(f) !== "" && Number.isFinite(v)) setValue(f, String(+(v * factor).toFixed(1)));
    });
    setUnit(next);
  };

  // Re-validate with the new unit's messages once the user has submitted.
  useEffect(() => {
    if (isSubmitted) trigger();
  }, [unit, gender, isSubmitted, trigger]);

  const mutation = useMutation({
    mutationFn: (v: FormOutput) =>
      calculateBodyFat({
        gender: v.gender,
        heightCm: +v.heightCm!.toFixed(1),
        neckCm: +v.neckCm!.toFixed(1),
        waistCm: +v.waistCm!.toFixed(1),
        hipCm: v.gender === "FEMALE" ? +v.hipCm!.toFixed(1) : undefined,
      }),
    onSuccess: (data, v) => setResult({ ...data, gender: v.gender }),
  });

  const serverError = mutation.isError
    ? isAxiosError(mutation.error)
      ? mutation.error.response?.data?.error?.message ?? "Could not calculate right now."
      : "Could not calculate right now."
    : null;

  const fields: Field[] = gender === "FEMALE" ? ["heightCm", "neckCm", "waistCm", "hipCm"] : ["heightCm", "neckCm", "waistCm"];

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <form
          noValidate
          className="glass-card flex h-fit flex-col gap-5 p-6"
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Sex (used by the formula)</legend>
              <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
                {(["MALE", "FEMALE"] as const).map((g) => (
                  <label
                    key={g}
                    className={cn(
                      "cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/60",
                      gender === g ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    <input type="radio" value={g} className="sr-only" {...register("gender")} />
                    {g === "MALE" ? "Male" : "Female"}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Units</legend>
              <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
                {(["cm", "in"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    onClick={() => switchUnit(u)}
                    className={cn(
                      "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                      unit === u ? "bg-gold text-accent-foreground" : "text-muted hover:text-foreground"
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field}>
                <label htmlFor={field} className="mb-1.5 block text-sm font-medium">
                  {LABELS[field]}
                </label>
                <div className="relative">
                  <Input
                    id={field}
                    inputMode="decimal"
                    className="pr-12"
                    aria-invalid={errors[field] ? true : undefined}
                    aria-describedby={`${field}-error`}
                    {...register(field)}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted">{unit}</span>
                </div>
                <FieldError id={`${field}-error`} message={errors[field]?.message} />
              </div>
            ))}
          </div>

          <FormAlert message={serverError} />

          <Button type="submit" disabled={mutation.isPending} className="uppercase tracking-wider">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Calculate
          </Button>
          {isAuthed && profile?.heightCm && (
            <p className="-mt-2 text-xs text-muted">Height pre-filled from your profile.</p>
          )}
        </form>

        <div className="flex flex-col gap-6">
          <section aria-live="polite" className="glass-card p-6">
            {result ? (
              <>
                <p className="text-sm text-muted">Estimated body fat</p>
                <p className="mt-1 text-6xl font-semibold tracking-tight">
                  {result.bodyFatPercent}
                  <span className="text-3xl text-muted">%</span>
                </p>
                <p className="mt-2 text-lg">
                  Category: <span className="font-semibold text-gold">{result.category}</span>
                </p>
                <Scale gender={result.gender} value={result.bodyFatPercent} />
                <p className="mt-4 text-xs text-muted">Method: {result.method}. Typical accuracy is within about ±3–4%.</p>
              </>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <Calculator className="h-10 w-10 text-gold/60" />
                <p className="mt-3 font-medium">Your estimate will appear here</p>
                <p className="mt-1 text-sm text-muted">Enter your measurements and press Calculate.</p>
              </div>
            )}
          </section>

          <section className="glass-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold uppercase">
              <Ruler className="h-5 w-5 text-gold" /> How to measure
            </h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-foreground/85">
              {HOW_TO.filter((h) => gender === "FEMALE" || h.field !== "hipCm").map((h) => (
                <li key={h.field}>
                  <span className="font-semibold">{LABELS[h.field]}:</span> {h.text}
                </li>
              ))}
              <li className="text-muted">Use a soft tape, measure on bare skin without compressing it, and take the average of 2–3 tries.</li>
            </ul>
          </section>

          <p className="flex gap-2 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            This is an estimate for tracking progress over time, not a medical assessment. It can be less accurate for very muscular
            people, during pregnancy, or with certain medical conditions — talk to a doctor or our coaches for a proper evaluation.
          </p>
        </div>
      </div>
    </div>
  );
}
