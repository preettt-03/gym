"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/profile-api";
import { CM_PER_IN, LB_PER_KG, type Sex } from "@/lib/calculators";
import { NumberField, readNumber, Segmented } from "@/components/tools/ui";

export type Units = "metric" | "imperial";
type Field = "age" | "height" | "weight";
export type BodyErrors = Partial<Record<Field, string>>;

const round1 = (n: number) => String(+n.toFixed(1));

/** Sex, age, height and weight shared by several tools, starting from the member's profile. */
export function useBodyInputs(profile: UserProfile | null) {
  const [units, setUnits] = useState<Units>("metric");
  const [sex, setSex] = useState<Sex>(profile?.gender === "FEMALE" ? "FEMALE" : "MALE");
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [height, setHeight] = useState(profile?.heightCm ? round1(profile.heightCm) : "");
  const [weight, setWeight] = useState(profile?.weightKg ? round1(profile.weightKg) : "");
  const [errors, setErrors] = useState<BodyErrors>({});

  // Switching units converts what's already typed instead of clearing it.
  const switchUnits = (next: Units) => {
    if (next === units) return;
    const toImperial = next === "imperial";
    const convert = (v: string, factor: number) => (v.trim() && Number.isFinite(Number(v)) ? round1(Number(v) * factor) : v);
    setHeight((h) => convert(h, toImperial ? 1 / CM_PER_IN : CM_PER_IN));
    setWeight((w) => convert(w, toImperial ? LB_PER_KG : 1 / LB_PER_KG));
    setUnits(next);
    setErrors({});
  };

  /** Validates the requested fields; returns metric values or null (and shows errors). */
  const read = (fields: Field[]) => {
    const imperial = units === "imperial";
    const found: BodyErrors = {};
    const out: { age?: number; heightCm?: number; weightKg?: number } = {};
    if (fields.includes("age")) {
      const r = readNumber(age, "Age", 15, 100, "years");
      if (r.error) found.age = r.error;
      else out.age = r.value;
    }
    if (fields.includes("height")) {
      const r = imperial ? readNumber(height, "Height", 39, 98, "in") : readNumber(height, "Height", 100, 250, "cm");
      if (r.error) found.height = r.error;
      else out.heightCm = imperial ? r.value! * CM_PER_IN : r.value;
    }
    if (fields.includes("weight")) {
      const r = imperial ? readNumber(weight, "Weight", 55, 660, "lb") : readNumber(weight, "Weight", 25, 300, "kg");
      if (r.error) found.weight = r.error;
      else out.weightKg = imperial ? r.value! / LB_PER_KG : r.value;
    }
    setErrors(found);
    return Object.keys(found).length ? null : out;
  };

  return { units, switchUnits, sex, setSex, age, setAge, height, setHeight, weight, setWeight, errors, read, prefilled: Boolean(profile) };
}

export type BodyInputs = ReturnType<typeof useBodyInputs>;

export function BodyFields({ body, fields, showSex = true }: { body: BodyInputs; fields: Field[]; showSex?: boolean }) {
  const imperial = body.units === "imperial";
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {showSex && (
          <Segmented
            label="Sex (used by the formula)"
            options={[
              { value: "MALE", label: "Male" },
              { value: "FEMALE", label: "Female" },
            ]}
            value={body.sex}
            onChange={body.setSex}
          />
        )}
        {(fields.includes("height") || fields.includes("weight")) && (
          <Segmented
            label="Units"
            options={[
              { value: "metric", label: "kg / cm" },
              { value: "imperial", label: "lb / in" },
            ]}
            value={body.units}
            onChange={body.switchUnits}
          />
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {fields.includes("age") && <NumberField id="age" label="Age" unit="yrs" value={body.age} onChange={body.setAge} error={body.errors.age} />}
        {fields.includes("height") && (
          <NumberField id="height" label="Height" unit={imperial ? "in" : "cm"} value={body.height} onChange={body.setHeight} error={body.errors.height} />
        )}
        {fields.includes("weight") && (
          <NumberField id="weight" label="Weight" unit={imperial ? "lb" : "kg"} value={body.weight} onChange={body.setWeight} error={body.errors.weight} />
        )}
      </div>
      {body.prefilled && <p className="-mt-2 text-xs text-muted">Pre-filled from your profile — change anything you like.</p>}
    </>
  );
}
