"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/profile-api";
import { bmi, BMI_BANDS, LB_PER_KG } from "@/lib/calculators";
import { BodyFields, useBodyInputs, type Units } from "@/components/tools/body-inputs";
import { Disclaimer, EmptyResult, fmt, Guide, InputsCard, ResultHero, Workspace } from "@/components/tools/ui";

const SCALE_MIN = 15;
const SCALE_MAX = 40;
const pos = (v: number) => ((Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

export function BmiCalculator({ profile }: { profile: UserProfile | null }) {
  const body = useBodyInputs(profile);
  const [result, setResult] = useState<(ReturnType<typeof bmi> & { units: Units }) | null>(null);

  const calculate = () => {
    const v = body.read(["height", "weight"]);
    if (v) setResult({ ...bmi(v.weightKg!, v.heightCm!), units: body.units });
  };

  const weightText = (kg: number) => (result?.units === "imperial" ? `${fmt(kg * LB_PER_KG)} lb` : `${fmt(kg, 1)} kg`);
  const edges = [SCALE_MIN, 18.5, 25, 30, SCALE_MAX];

  return (
    <Workspace
      inputs={
        <InputsCard onSubmit={calculate}>
          <BodyFields body={body} fields={["height", "weight"]} showSex={false} />
        </InputsCard>
      }
      results={
        result ? (
          <>
            <ResultHero label="Body mass index" value={fmt(result.value, 1)}>
              <p className="mt-2 text-lg">
                Category: <span className="font-semibold text-gold">{result.category}</span>
              </p>
              <div className="mt-6" aria-hidden>
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                  {BMI_BANDS.map((b, i) => (
                    <span
                      key={b.label}
                      style={{ width: `${pos(edges[i + 1]) - pos(edges[i])}%`, background: `color-mix(in srgb, var(--gold) ${i === 1 ? 90 : 35 + i * 10}%, var(--surface-2))` }}
                    />
                  ))}
                </div>
                <div className="relative h-4">
                  <span className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded bg-foreground" style={{ left: `${pos(result.value)}%` }} />
                </div>
                <div className="grid grid-cols-4 text-center text-[11px] text-muted">
                  {BMI_BANDS.map((b) => (
                    <span key={b.label}>{b.label}</span>
                  ))}
                </div>
              </div>
              <p className="mt-4 rounded-xl border border-border bg-surface-2/50 p-3 text-sm">
                Healthy weight for your height: <span className="font-semibold text-gold">{weightText(result.healthyMinKg)} – {weightText(result.healthyMaxKg)}</span>
              </p>
            </ResultHero>
            <Guide
              tips={[
                "BMI is a quick screening number, not a verdict — it can't tell muscle from fat.",
                "Lifters often read “overweight” while lean; pair BMI with the Body Fat tool.",
                "Track the trend over months rather than any single reading.",
              ]}
            />
            <Disclaimer>WHO adult categories. Not suitable for children, pregnancy, or older adults without a doctor&apos;s context.</Disclaimer>
          </>
        ) : (
          <EmptyResult />
        )
      }
    />
  );
}
