"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/profile-api";
import { ACTIVITY_LEVELS, bmrMifflin, CALORIE_GOALS, MIN_SAFE_CALORIES, tdee, type ActivityLevel, type Sex } from "@/lib/calculators";
import { Select } from "@/components/ui/select";
import { BodyFields, useBodyInputs } from "@/components/tools/body-inputs";
import { Disclaimer, EmptyResult, fmt, Guide, InputsCard, ResultHero, Workspace } from "@/components/tools/ui";
import { cn } from "@/lib/utils";

export function TdeeCalculator({ profile }: { profile: UserProfile | null }) {
  const body = useBodyInputs(profile);
  const [activity, setActivity] = useState<ActivityLevel>((profile?.activityLevel as ActivityLevel) ?? "MODERATELY_ACTIVE");
  const [result, setResult] = useState<{ bmr: number; tdee: number; sex: Sex } | null>(null);

  const calculate = () => {
    const v = body.read(["age", "height", "weight"]);
    if (!v) return;
    const bmr = bmrMifflin(body.sex, v.weightKg!, v.heightCm!, v.age!);
    setResult({ bmr, tdee: tdee(bmr, activity), sex: body.sex });
  };

  return (
    <Workspace
      inputs={
        <InputsCard onSubmit={calculate}>
          <BodyFields body={body} fields={["age", "height", "weight"]} />
          <div>
            <label htmlFor="activity" className="mb-1.5 block text-sm font-medium">
              Activity level
            </label>
            <Select id="activity" value={activity} onChange={(v) => setActivity(v as ActivityLevel)} options={ACTIVITY_LEVELS.map((a) => ({ value: a.value, label: `${a.label} — ${a.hint}` }))} />
          </div>
        </InputsCard>
      }
      results={
        result ? (
          <>
            <ResultHero label="Maintenance calories (TDEE)" value={fmt(result.tdee)} unit="kcal / day">
              <p className="mt-2 text-sm text-muted">BMR {fmt(result.bmr)} kcal × activity {ACTIVITY_LEVELS.find((a) => a.value === activity)!.factor}</p>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {CALORIE_GOALS.map((g) => {
                  const kcal = result.tdee * g.factor;
                  const low = kcal < MIN_SAFE_CALORIES[result.sex];
                  return (
                    <li key={g.key} className={cn("rounded-xl border p-3", g.key === "maintain" ? "border-gold/50 bg-gold/5" : "border-border bg-surface-2/50")}>
                      <p className="text-xs uppercase tracking-wider text-muted">{g.label}</p>
                      <p className="mt-0.5 font-display text-2xl font-bold">{fmt(kcal)} <span className="text-sm font-normal text-muted">kcal</span></p>
                      <p className={cn("text-xs", low ? "text-[#fab219]" : "text-muted")}>{low ? "Very low — only with professional guidance" : g.note}</p>
                    </li>
                  );
                })}
              </ul>
            </ResultHero>
            <Guide
              tips={[
                "Eat at your goal number for 2–3 weeks, weighing yourself each morning, then adjust by 100–200 kcal.",
                "Losing faster than 1% of body weight a week usually costs muscle.",
                "Turn the calories into a plan with the Macro Split tool.",
              ]}
            />
            <Disclaimer>Estimates use the Mifflin-St Jeor equation and are typically within ±10% for most adults.</Disclaimer>
          </>
        ) : (
          <EmptyResult />
        )
      }
    />
  );
}
