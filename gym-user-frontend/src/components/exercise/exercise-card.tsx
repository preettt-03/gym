import Link from "next/link";
import { ChevronRight, Dumbbell } from "lucide-react";
import type { Exercise } from "@/lib/api";
import { FavoriteButton } from "@/components/exercise/favorite-button";
import { cn } from "@/lib/utils";

const DIFFICULTY_STYLE: Record<Exercise["difficulty"], string> = {
  BEGINNER: "border-success/30 text-success",
  INTERMEDIATE: "border-gold/40 text-gold",
  ADVANCED: "border-danger/40 text-danger",
};

export const difficultyLabel = (d: Exercise["difficulty"]) => d.charAt(0) + d.slice(1).toLowerCase();

export function DifficultyBadge({ difficulty }: { difficulty: Exercise["difficulty"] }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", DIFFICULTY_STYLE[difficulty])}>
      {difficultyLabel(difficulty)}
    </span>
  );
}

// The title link stretches over the whole card (::after), while the heart
// sits above it as a separate control — no button nested inside a link.
export function ExerciseCard({ exercise, meta }: { exercise: Exercise; meta?: string }) {
  return (
    <article className="glass-card card-hover group relative flex h-full flex-col gap-3 p-5 focus-within:border-gold/60">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
          <Dumbbell className="h-5 w-5 text-gold" />
        </span>
        <div className="relative z-10">
          <FavoriteButton exercise={exercise} />
        </div>
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold uppercase leading-tight">
          <Link href={`/exercises/${exercise.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-[inherit]">
            {exercise.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">{exercise.targetMuscle}</p>
        {exercise.equipment.length > 0 && <p className="mt-1 text-xs text-muted">{exercise.equipment.join(" · ")}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <DifficultyBadge difficulty={exercise.difficulty} />
        <span aria-hidden="true" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gold">
          {meta ?? "Details"} <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
