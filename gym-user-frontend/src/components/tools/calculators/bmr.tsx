"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/profile-api";
import { ACTIVITY_LEVELS, bmrHarrisBenedict, bmrMifflin } from "@/lib/calculators";
import { BodyFields, useBodyInputs } from "@/components/tools/body-inputs";
import { BarRow, Disclaimer, EmptyResult, fmt, Guide, InputsCard, ResultHero, Workspace } from "@/components/tools/ui";

export function BmrCalculator({ profile }: { profile: UserProfile | null }) {
  const body = useBodyInputs(profile);
  const [result, setResult] = useState<{ harris: number; mifflin: number } | null>(null);

  const calculate = () => {
    const v = body.read(["age", "height", "weight"]);
    if (!v) return;
    setResult({
      harris: bmrHarrisBenedict(body.sex, v.weightKg!, v.heightCm!, v.age!),
      mifflin: bmrMifflin(body.sex, v.weightKg!, v.heightCm!, v.age!),
    });
  };

  const top = result ? result.harris * ACTIVITY_LEVELS.at(-1)!.factor : 1;

  return (
    <Workspace
      inputs={
        <InputsCard onSubmit={calculate}>
          <BodyFields body={body} fields={["age", "height", "weight"]} />
        </InputsCard>
      }
      results={
        result ? (
          <>
            <ResultHero label="Basal metabolic rate" value={fmt(result.harris)} unit="kcal / day">
              <p className="mt-2 text-sm text-muted">
                Harris-Benedict (revised). Mifflin-St Jeor gives {fmt(result.mifflin)} kcal — real values usually sit between the two.
              </p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Daily burn with activity</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {ACTIVITY_LEVELS.map((a) => (
                  <BarRow key={a.value} label={a.label} value={`${fmt(result.harris * a.factor)} kcal`} fill={((result.harris * a.factor) / top) * 100} />
                ))}
              </ul>
            </ResultHero>
            <Guide
              tips={[
                "BMR is the energy for breathing, circulation and organs — before any movement.",
                "Don't eat below your BMR for long; it slows recovery and costs muscle.",
                "For a daily target that includes activity and your goal, use the TDEE tool.",
              ]}
            />
            <Disclaimer>Formulas estimate; muscle mass, genetics and health conditions shift the real number.</Disclaimer>
          </>
        ) : (
          <EmptyResult />
        )
      }
    />
  );
}
