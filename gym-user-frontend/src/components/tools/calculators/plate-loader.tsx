"use client";

import { useState } from "react";
import { loadPlates, PLATE_SETS } from "@/lib/calculators";
import { EmptyResult, fmt, Guide, InputsCard, NumberField, readNumber, ResultHero, Segmented, Workspace } from "@/components/tools/ui";
import { cn } from "@/lib/utils";

type Unit = "kg" | "lb";
const BARS: Record<Unit, { value: string; label: string }[]> = {
  kg: [
    { value: "20", label: "20 kg Olympic" },
    { value: "15", label: "15 kg Women's" },
    { value: "10", label: "10 kg Technique" },
  ],
  lb: [
    { value: "45", label: "45 lb Olympic" },
    { value: "35", label: "35 lb Women's" },
    { value: "15", label: "15 lb Technique" },
  ],
};

// IWF-style colours so the drawing matches bumper plates in the gym.
const PLATE_STYLE: Record<string, { color: string; height: number; width: number }> = {
  "kg-25": { color: "#c0392b", height: 100, width: 18 },
  "kg-20": { color: "#2563eb", height: 100, width: 16 },
  "kg-15": { color: "#eab308", height: 92, width: 14 },
  "kg-10": { color: "#16a34a", height: 82, width: 12 },
  "kg-5": { color: "#e5e5e5", height: 62, width: 10 },
  "kg-2.5": { color: "#3f3f46", height: 52, width: 8 },
  "kg-1.25": { color: "#a1a1aa", height: 44, width: 7 },
  "lb-45": { color: "#2563eb", height: 100, width: 17 },
  "lb-35": { color: "#eab308", height: 92, width: 15 },
  "lb-25": { color: "#16a34a", height: 82, width: 13 },
  "lb-10": { color: "#e5e5e5", height: 62, width: 10 },
  "lb-5": { color: "#3f3f46", height: 52, width: 8 },
  "lb-2.5": { color: "#a1a1aa", height: 44, width: 7 },
};

function Barbell({ side, unit }: { side: number[]; unit: Unit }) {
  const plates = (list: number[]) =>
    list.map((p, i) => {
      const s = PLATE_STYLE[`${unit}-${p}`];
      return <span key={i} className="shrink-0 rounded-sm border border-black/40" style={{ background: s.color, height: `${s.height}%`, width: s.width }} title={`${p} ${unit}`} />;
    });
  return (
    <div className="carbon mt-5 flex h-36 items-center justify-center overflow-hidden rounded-xl border border-border px-2" role="img" aria-label={`Each side: ${side.join(", ") || "no plates"} ${unit}`}>
      <span className="h-3 w-8 shrink-0 rounded-l bg-zinc-400" />
      <div className="flex h-full flex-row-reverse items-center gap-0.5">{plates(side)}</div>
      <span className="h-6 w-2 shrink-0 bg-zinc-300" />
      <span className="h-2.5 min-w-10 flex-1 bg-linear-to-b from-zinc-300 to-zinc-500" />
      <span className="h-6 w-2 shrink-0 bg-zinc-300" />
      <div className="flex h-full items-center gap-0.5">{plates(side)}</div>
      <span className="h-3 w-8 shrink-0 rounded-r bg-zinc-400" />
    </div>
  );
}

export function PlateLoaderCalculator() {
  const [unit, setUnit] = useState<Unit>("kg");
  const [target, setTarget] = useState("");
  const [bar, setBar] = useState("20");
  const [available, setAvailable] = useState<number[]>([...PLATE_SETS.kg]);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<(ReturnType<typeof loadPlates> & { unit: Unit; target: number; bar: number }) | null>(null);

  const switchUnit = (next: Unit) => {
    if (next === unit) return;
    setUnit(next);
    setBar(BARS[next][0].value);
    setAvailable([...PLATE_SETS[next]]);
    setTarget("");
    setResult(null);
  };

  const calculate = () => {
    const barWeight = Number(bar);
    const t = readNumber(target, "Target weight", barWeight, unit === "kg" ? 500 : 1100, unit);
    setError(t.error);
    if (t.error) return;
    setResult({ ...loadPlates(t.value!, barWeight, available), unit, target: t.value!, bar: barWeight });
  };

  const counts = result ? Object.entries(result.side.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }), {})).sort((a, b) => Number(b[0]) - Number(a[0])) : [];

  return (
    <Workspace
      inputs={
        <InputsCard onSubmit={calculate}>
          <Segmented label="Units" options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} value={unit} onChange={switchUnit} />
          <NumberField id="target" label="Target weight" unit={unit} value={target} onChange={setTarget} error={error} placeholder={unit === "kg" ? "e.g. 100" : "e.g. 225"} />
          <Segmented label="Bar" options={BARS[unit]} value={bar} onChange={setBar} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Plates available</legend>
            <div className="flex flex-wrap gap-2">
              {PLATE_SETS[unit].map((p) => {
                const on = available.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAvailable((a) => (on ? a.filter((x) => x !== p) : [...a, p]))}
                    className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", on ? "border-gold/60 bg-gold/10 text-foreground" : "border-border text-muted line-through")}
                  >
                    <span className="h-3 w-3 rounded-full border border-black/40" style={{ background: PLATE_STYLE[`${unit}-${p}`].color }} />
                    {p} {unit}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </InputsCard>
      }
      results={
        result ? (
          <>
            <ResultHero label="Load on each side" value={fmt(result.perSide, 2)} unit={result.unit}>
              <Barbell side={result.side} unit={result.unit} />
              {counts.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {counts.map(([p, n]) => (
                    <li key={p} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-sm">
                      <span className="h-3 w-3 rounded-full border border-black/40" style={{ background: PLATE_STYLE[`${result.unit}-${p}`].color }} />
                      <span className="font-semibold">{n} ×</span> {p} {result.unit}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">Just the bar — no plates needed.</p>
              )}
              {result.remainder > 0 ? (
                <p role="alert" className="mt-4 rounded-xl border border-[#fab219]/40 bg-[#fab219]/10 p-3 text-sm text-[#fab219]">
                  Can&apos;t make exactly {fmt(result.target, 2)} {result.unit} with these plates — closest is {fmt(result.loaded, 2)} {result.unit} ({fmt(result.remainder, 2)} short).
                </p>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  Bar {result.bar} {result.unit} + {fmt(result.perSide, 2)} {result.unit} × 2 = <span className="font-semibold text-gold">{fmt(result.loaded, 2)} {result.unit}</span>
                </p>
              )}
            </ResultHero>
            <Guide
              title="Loading tips"
              tips={["Load the heaviest plates first, closest to the collar.", "Always use collars/clips on both sides.", "Untick plates your gym doesn't have and the plan updates."]}
            />
          </>
        ) : (
          <EmptyResult text="Enter the total weight you want on the bar." />
        )
      }
    />
  );
}
