"use client";

import { useState } from "react";
import type { UserProfile } from "@/lib/profile-api";
import { HR_ZONES, maxHeartRate, zoneBpm } from "@/lib/calculators";
import { Disclaimer, EmptyResult, fmt, Guide, InputsCard, NumberField, readNumber, ResultHero, Workspace } from "@/components/tools/ui";
import { cn } from "@/lib/utils";

export function HeartRateCalculator({ profile }: { profile: UserProfile | null }) {
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [resting, setResting] = useState("");
  const [errors, setErrors] = useState<{ age?: string; resting?: string }>({});
  const [result, setResult] = useState<{ max: number; resting?: number } | null>(null);

  const calculate = () => {
    const a = readNumber(age, "Age", 10, 100, "years");
    const r = resting.trim() ? readNumber(resting, "Resting heart rate", 30, 110, "bpm") : {};
    setErrors({ age: a.error, resting: r.error });
    if (a.error || r.error) return;
    setResult({ max: maxHeartRate(a.value!), resting: r.value });
  };

  return (
    <Workspace
      inputs={
        <InputsCard onSubmit={calculate}>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="age" label="Age" unit="yrs" value={age} onChange={setAge} error={errors.age} />
            <NumberField id="resting" label="Resting heart rate" hint="optional" unit="bpm" value={resting} onChange={setResting} error={errors.resting} placeholder="e.g. 62" />
          </div>
          <p className="text-xs text-muted">Measure your pulse for 60 seconds right after waking. With it, zones use the more personal Karvonen method.</p>
        </InputsCard>
      }
      results={
        result ? (
          <>
            <ResultHero label="Maximum heart rate" value={fmt(result.max)} unit="bpm">
              <p className="mt-2 text-sm text-muted">{result.resting ? `Karvonen zones · resting ${result.resting} bpm` : "Zones as % of max (add resting HR for Karvonen)"}</p>
              <ul className="mt-5 flex flex-col gap-2">
                {HR_ZONES.map((z) => (
                  <li key={z.zone} className={cn("rounded-xl border p-3", z.zone === 2 ? "border-gold/50 bg-gold/5" : "border-border bg-surface-2/50")}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-xs text-gold">{z.zone}</span>
                        {z.name} <span className="text-xs font-normal text-muted">{z.from}–{z.to}%</span>
                      </span>
                      <span className="font-display text-lg font-bold tabular-nums">
                        {fmt(zoneBpm(result.max, z.from, result.resting))}–{fmt(zoneBpm(result.max, z.to, result.resting))} <span className="text-xs font-normal text-muted">bpm</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <div className="h-full rounded-full bg-gold" style={{ marginLeft: `${(z.from - 50) * 2}%`, width: `${(z.to - z.from) * 2}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">{z.use}</p>
                  </li>
                ))}
              </ul>
            </ResultHero>
            <Guide
              tips={[
                "Spend most of your weekly cardio (about 80%) in zones 1–2.",
                "Add 1–2 shorter sessions a week in zones 3–4 to raise fitness.",
                "Zone 5 is for brief intervals only — 30 seconds to 2 minutes.",
              ]}
            />
            <Disclaimer>Max heart rate uses the Tanaka formula (208 − 0.7 × age). Heart conditions or beta-blockers change your zones — ask your doctor.</Disclaimer>
          </>
        ) : (
          <EmptyResult />
        )
      }
    />
  );
}
