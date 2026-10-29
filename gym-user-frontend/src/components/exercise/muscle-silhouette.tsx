"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type SilhouetteGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core";

// Front-view figure with the target area lit in gold — the fallback when an
// exercise has no photos yet, so cards never show a stretched logo or blank box.
const REGIONS: Record<SilhouetteGroup | "base", string[]> = {
  base: [
    "M100 14a19 19 0 1 1 0 38a19 19 0 1 1 0-38z",
    "M91 50h18v14H91z",
    "M66 66c10-6 24-8 34-8s24 2 34 8c6 4 8 12 8 22l-4 64c-1 14-6 24-14 30H76c-8-6-13-16-14-30l-4-64c0-10 2-18 8-22z",
    "M76 182h48l6 18-10 10H80l-10-10z",
  ],
  shoulders: ["M50 70c8-8 20-8 26-2l-4 22c-8 2-18 0-24-6c-2-6-1-10 2-14z", "M150 70c-8-8-20-8-26-2l4 22c8 2 18 0 24-6c2-6 1-10-2-14z"],
  chest: ["M100 72c-8-4-20-4-28 2c-4 6-4 16 2 22c8 6 20 6 26 0z", "M100 72c8-4 20-4 28 2c4 6 4 16-2 22c-8 6-20 6-26 0z"],
  back: ["M70 92c-6 14-6 34 2 50l10 6c-2-16-2-36 2-52z", "M130 92c6 14 6 34-2 50l-10 6c2-16 2-36-2-52z"],
  core: [
    "M89 104h9v13h-9z", "M102 104h9v13h-9z",
    "M89 121h9v13h-9z", "M102 121h9v13h-9z",
    "M89 138h9v14h-9z", "M102 138h9v14h-9z",
    "M88 156h10l-1 18h-9z", "M102 156h10v18h-9z",
  ],
  arms: [
    "M46 92c-6 8-10 26-10 40c4 4 12 4 16 0c2-14 6-28 6-38z", "M154 92c6 8 10 26 10 40c-4 4-12 4-16 0c-2-14-6-28-6-38z",
    "M36 138c-4 12-6 28-6 40c4 3 9 3 12 0c2-12 6-26 8-38z", "M164 138c4 12 6 28 6 40c-4 3-9 3-12 0c-2-12-6-26-8-38z",
  ],
  legs: [
    "M78 208c-6 18-8 44-6 66c6 6 18 6 24 0c2-22 2-46 0-64z", "M122 208c6 18 8 44 6 66c-6 6-18 6-24 0c-2-22-2-46 0-64z",
    "M74 282c-2 14-2 30 0 44c4 4 12 4 16 0c2-14 2-30 0-44z", "M126 282c2 14 2 30 0 44c-4 4-12 4-16 0c-2-14-2-30 0-44z",
  ],
};

// Limbs that are drawn as base body when they aren't the highlighted group.
const LIMBS: SilhouetteGroup[] = ["shoulders", "arms", "legs"];

export function MuscleSilhouette({ group, label, className }: { group: SilhouetteGroup | null; label?: string; className?: string }) {
  const glowId = useId();
  return (
    <div className={cn("carbon relative flex h-full w-full items-center justify-center overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(226,196,110,0.10),transparent_65%)]" />
      <svg viewBox="0 0 200 340" role="img" aria-label={label ?? "Muscle diagram"} className="relative h-[82%] w-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g fill="#232323" stroke="#3a3a3a" strokeWidth="1.2">
          {REGIONS.base.map((d) => (
            <path key={d} d={d} />
          ))}
          {LIMBS.filter((g) => g !== group).flatMap((g) => REGIONS[g]).map((d) => (
            <path key={d} d={d} />
          ))}
          {(["chest", "core"] as const).filter((g) => g !== group).flatMap((g) => REGIONS[g]).map((d) => (
            <path key={d} d={d} fill="#2b2b2b" />
          ))}
        </g>
        {group && (
          <g fill="var(--gold)" stroke="var(--gold-light)" strokeWidth="1" filter={`url(#${glowId})`} opacity="0.95">
            {REGIONS[group].map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
