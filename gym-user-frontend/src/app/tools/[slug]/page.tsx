"use client";

import { useParams } from "next/navigation";
import { ToolPage } from "@/components/tools/ui";
import { OneRepMaxCalculator } from "@/components/tools/calculators/one-rep-max";
import { TdeeCalculator } from "@/components/tools/calculators/tdee";
import { MacroCalculator } from "@/components/tools/calculators/macros";
import { BmrCalculator } from "@/components/tools/calculators/bmr";
import { BmiCalculator } from "@/components/tools/calculators/bmi";
import { WaterCalculator } from "@/components/tools/calculators/water";
import { HeartRateCalculator } from "@/components/tools/calculators/heart-rate";
import { PlateLoaderCalculator } from "@/components/tools/calculators/plate-loader";
import { RestTimer } from "@/components/tools/calculators/rest-timer";
import type { UserProfile } from "@/lib/profile-api";

// body-fat has its own route (it calls the API); everything else is here.
const CALCULATORS: Record<string, (profile: UserProfile | null) => React.ReactNode> = {
  "1rm": () => <OneRepMaxCalculator />,
  tdee: (p) => <TdeeCalculator profile={p} />,
  macros: () => <MacroCalculator />,
  bmr: (p) => <BmrCalculator profile={p} />,
  bmi: (p) => <BmiCalculator profile={p} />,
  water: (p) => <WaterCalculator profile={p} />,
  "heart-rate": (p) => <HeartRateCalculator profile={p} />,
  "plate-loader": () => <PlateLoaderCalculator />,
  timer: () => <RestTimer />,
};

export default function ToolDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const render = CALCULATORS[slug];
  return (
    <ToolPage slug={slug}>
      {(profile) =>
        render ? render(profile) : <p className="rounded-2xl border border-dashed border-border px-6 py-14 text-center text-muted">This tool isn&apos;t built yet.</p>
      }
    </ToolPage>
  );
}
