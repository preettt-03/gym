"use client";

import { useState } from "react";
import { Droplet } from "lucide-react";
import type { UserProfile } from "@/lib/profile-api";
import { waterLiters } from "@/lib/calculators";
import { BodyFields, useBodyInputs } from "@/components/tools/body-inputs";
import { BarRow, EmptyResult, fmt, Guide, InputsCard, NumberField, readNumber, ResultHero, Segmented, Workspace } from "@/components/tools/ui";

const GLASS_L = 0.25;

export function WaterCalculator({ profile }: { profile: UserProfile | null }) {
  const body = useBodyInputs(profile);
  const [minutes, setMinutes] = useState("60");
  const [hot, setHot] = useState<"no" | "yes">("no");
  const [minutesError, setMinutesError] = useState<string>();
  const [result, setResult] = useState<ReturnType<typeof waterLiters> | null>(null);

  const calculate = () => {
    const m = readNumber(minutes, "Workout minutes", 0, 600, "min");
    setMinutesError(m.error);
    const v = body.read(["weight"]);
    if (!v || m.error) return;
    setResult(waterLiters(v.weightKg!, m.value!, hot === "yes"));
  };

  const glasses = result ? Math.ceil(result.total / GLASS_L) : 0;

  return (
    <Workspace
      inputs={
        <InputsCard onSubmit={calculate}>
          <BodyFields body={body} fields={["weight"]} showSex={false} />
          <NumberField id="minutes" label="Training today" unit="min" value={minutes} onChange={setMinutes} error={minutesError} />
          <Segmented label="Hot or humid weather?" options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} value={hot} onChange={setHot} />
        </InputsCard>
      }
      results={
        result ? (
          <>
            <ResultHero label="Drink per day" value={fmt(result.total, 1)} unit="litres">
              <p className="mt-2 text-sm text-muted">About {glasses} glasses of 250 ml</p>
              <div className="mt-4 flex flex-wrap gap-1" aria-hidden>
                {Array.from({ length: Math.min(glasses, 24) }, (_, i) => (
                  <Droplet key={i} className="h-5 w-5 fill-gold/30 text-gold" />
                ))}
              </div>
              <ul className="mt-5 flex flex-col gap-1.5">
                <BarRow label="Baseline (35 ml per kg)" value={`${fmt(result.base, 1)} L`} fill={(result.base / result.total) * 100} />
                <BarRow label="Training" value={`${fmt(result.training, 1)} L`} fill={(result.training / result.total) * 100} />
                {result.heat > 0 && <BarRow label="Heat" value={`${fmt(result.heat, 1)} L`} fill={(result.heat / result.total) * 100} />}
              </ul>
            </ResultHero>
            <Guide
              tips={[
                "Sip steadily through the day instead of drinking it all at once.",
                "Drink 400–600 ml in the 2 hours before training, and sip during long sessions.",
                "Pale yellow urine is a good sign you're on track.",
                "Food (fruit, dal, curd) supplies about 20% of your water too.",
              ]}
            />
          </>
        ) : (
          <EmptyResult />
        )
      }
    />
  );
}
