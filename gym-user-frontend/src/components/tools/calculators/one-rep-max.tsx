"use client";

import { useState } from "react";
import { LB_PER_KG, ONE_RM_FORMULAS, ONE_RM_PERCENTAGES, oneRepMax, type OneRmFormula } from "@/lib/calculators";
import { Select } from "@/components/ui/select";
import { BarRow, EmptyResult, fmt, Guide, InputsCard, NumberField, readNumber, ResultHero, Segmented, Workspace } from "@/components/tools/ui";

type Unit = "kg" | "lb";
const FORMULA_OPTIONS = [
  { value: "average", label: "Average of all three" },
  ...Object.entries(ONE_RM_FORMULAS).map(([value, f]) => ({ value, label: f.label })),
];

// Rounds to what you can actually load: 2.5 kg / 5 lb steps.
const toLoadable = (n: number, unit: Unit) => Math.round(n / (unit === "kg" ? 2.5 : 5)) * (unit === "kg" ? 2.5 : 5);

export function OneRepMaxCalculator() {
  const [unit, setUnit] = useState<Unit>("kg");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [formula, setFormula] = useState<OneRmFormula>("average");
  const [errors, setErrors] = useState<{ weight?: string; reps?: string }>({});
  const [result, setResult] = useState<{ max: number; unit: Unit; reps: number } | null>(null);

  const calculate = () => {
    const w = unit === "kg" ? readNumber(weight, "Weight", 1, 500, "kg") : readNumber(weight, "Weight", 2, 1100, "lb");
    const r = readNumber(reps, "Reps", 1, 12);
    if (r.value !== undefined && !Number.isInteger(r.value)) r.error = "Use whole reps";
    setErrors({ weight: w.error, reps: r.error });
    if (w.error || r.error) return;
    setResult({ max: oneRepMax(w.value!, r.value!, formula), unit, reps: r.value! });
  };

  const switchUnit = (next: Unit) => {
    if (next === unit) return;
    const v = Number(weight);
    if (weight.trim() && Number.isFinite(v)) setWeight(String(+(next === "lb" ? v * LB_PER_KG : v / LB_PER_KG).toFixed(1)));
    setUnit(next);
  };

  return (
    <Workspace
      inputs={
        <InputsCard onSubmit={calculate}>
          <Segmented label="Units" options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} value={unit} onChange={switchUnit} />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="weight" label="Weight lifted" unit={unit} value={weight} onChange={setWeight} error={errors.weight} placeholder={unit === "kg" ? "e.g. 80" : "e.g. 175"} />
            <NumberField id="reps" label="Reps completed" hint="1–12" value={reps} onChange={setReps} error={errors.reps} placeholder="e.g. 5" />
          </div>
          <div>
            <label htmlFor="formula" className="mb-1.5 block text-sm font-medium">
              Formula
            </label>
            <Select id="formula" value={formula} onChange={(v) => setFormula(v as OneRmFormula)} options={FORMULA_OPTIONS} />
          </div>
        </InputsCard>
      }
      results={
        result ? (
          <>
            <ResultHero label="Estimated 1RM" value={fmt(result.max, 1)} unit={result.unit}>
              <p className="mt-2 text-sm text-muted">
                From {result.reps} rep{result.reps === 1 ? "" : "s"}. Loadable: <span className="font-semibold text-foreground">{fmt(toLoadable(result.max, result.unit), 1)} {result.unit}</span>
              </p>
              <ul className="mt-5 flex flex-col gap-1.5" aria-label="Training loads by percentage">
                {ONE_RM_PERCENTAGES.map((p) => (
                  <BarRow
                    key={p.pct}
                    fill={p.pct}
                    highlight={p.pct === 100}
                    label={
                      <>
                        {p.pct}% <span className="text-xs text-muted">· {p.reps} {p.reps === "1" ? "rep" : "reps"}</span>
                      </>
                    }
                    value={`${fmt(toLoadable((result.max * p.pct) / 100, result.unit), 1)} ${result.unit}`}
                  />
                ))}
              </ul>
            </ResultHero>
            <Guide
              tips={[
                "Strength: 3–5 sets of 3–6 reps at 80–90%.",
                "Muscle growth: 3–4 sets of 8–12 reps at 65–80%.",
                "Re-test every 4–6 weeks; estimates are most accurate from sets of 3–6 reps.",
                "Don't max out alone — use a spotter or safety bars for anything above 90%.",
              ]}
            />
          </>
        ) : (
          <EmptyResult text="Enter a set you just did — e.g. 80 kg for 5 reps." />
        )
      }
    />
  );
}
