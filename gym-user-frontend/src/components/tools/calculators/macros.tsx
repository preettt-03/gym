"use client";

import { useState } from "react";
import { MACRO_PRESETS, macroGrams } from "@/lib/calculators";
import { EmptyResult, fmt, Guide, InputsCard, NumberField, readNumber, ResultHero, Workspace } from "@/components/tools/ui";
import { cn } from "@/lib/utils";

type Split = { protein: number; carbs: number; fat: number };
const MACROS = [
  { key: "protein", label: "Protein", kcal: 4, color: "var(--gold)" },
  { key: "carbs", label: "Carbs", kcal: 4, color: "var(--gold-dark)" },
  { key: "fat", label: "Fat", kcal: 9, color: "#8a7a4a" },
] as const;

export function MacroCalculator() {
  const [calories, setCalories] = useState("");
  const [preset, setPreset] = useState<string>("balanced");
  const [split, setSplit] = useState<Split>({ protein: 30, carbs: 40, fat: 30 });
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ calories: number; split: Split } | null>(null);
  const total = split.protein + split.carbs + split.fat;

  const choose = (key: string) => {
    setPreset(key);
    const p = MACRO_PRESETS.find((m) => m.key === key);
    if (p) setSplit({ protein: p.protein, carbs: p.carbs, fat: p.fat });
  };

  const calculate = () => {
    const c = readNumber(calories, "Calories", 800, 8000, "kcal");
    setError(c.error);
    if (c.error || total !== 100) return;
    setResult({ calories: c.value!, split });
  };

  const grams = result && macroGrams(result.calories, result.split);

  return (
    <Workspace
      inputs={
        <InputsCard onSubmit={calculate}>
          <NumberField id="calories" label="Daily calories" unit="kcal" hint="Not sure? Use the TDEE tool" value={calories} onChange={setCalories} error={error} placeholder="e.g. 2400" />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Split</legend>
            <div className="flex flex-wrap gap-2">
              {[...MACRO_PRESETS.map((p) => ({ key: p.key, label: `${p.label} ${p.protein}/${p.carbs}/${p.fat}` })), { key: "custom", label: "Custom" }].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={preset === p.key}
                  onClick={() => choose(p.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    preset === p.key ? "border-gold bg-gold text-accent-foreground" : "border-border bg-surface-2 text-muted hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>
          {MACROS.map((m) => (
            <div key={m.key}>
              <label htmlFor={`pct-${m.key}`} className="mb-1 flex justify-between text-sm font-medium">
                {m.label}
                <span className="tabular-nums text-gold">{split[m.key]}%</span>
              </label>
              <input
                id={`pct-${m.key}`}
                type="range"
                min={0}
                max={80}
                step={5}
                value={split[m.key]}
                onChange={(e) => {
                  setPreset("custom");
                  setSplit((s) => ({ ...s, [m.key]: Number(e.target.value) }));
                }}
                className="w-full accent-[var(--gold)]"
              />
            </div>
          ))}
          <p role={total !== 100 ? "alert" : undefined} className={cn("text-xs", total === 100 ? "text-muted" : "text-danger")}>
            Total {total}% {total !== 100 && `— adjust to exactly 100% (${total > 100 ? "remove" : "add"} ${Math.abs(100 - total)}%)`}
          </p>
        </InputsCard>
      }
      results={
        result && grams ? (
          <>
            <ResultHero label="Daily protein" value={fmt(grams.protein)} unit="g">
              <div className="mt-5 flex h-3 overflow-hidden rounded-full" aria-hidden>
                {MACROS.map((m) => (
                  <span key={m.key} style={{ width: `${result.split[m.key]}%`, background: m.color }} />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-3 gap-2">
                {MACROS.map((m) => (
                  <li key={m.key} className="rounded-xl border border-border bg-surface-2/50 p-3">
                    <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} /> {m.label}
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold">{fmt(grams[m.key])}g</p>
                    <p className="text-xs text-muted">
                      {result.split[m.key]}% · {fmt((result.calories * result.split[m.key]) / 100)} kcal
                    </p>
                  </li>
                ))}
              </ul>
            </ResultHero>
            <Guide
              tips={[
                "Hit protein first: spread it over 3–5 meals of roughly 25–40 g each.",
                "Carbs fuel training — put more of them around your workouts.",
                "Keep fat above ~20% of calories for healthy hormones.",
                "Log meals in Nutrition to see how close you get each day.",
              ]}
            />
          </>
        ) : (
          <EmptyResult text="Enter your daily calories and choose a split." />
        )
      }
    />
  );
}
