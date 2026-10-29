import Link from "next/link";
import { ChevronRight, Dumbbell, PlayCircle } from "lucide-react";
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
  const cover = exercise.thumbnailUrl ?? exercise.images[0];
  const secondary = exercise.secondaryMuscles ?? [];

  return (
    <article className="glass-card card-hover group relative flex h-full flex-col overflow-hidden focus-within:border-gold/60">
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {cover ? (
          // Exercise media is admin-uploaded and served from the API host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-linear-to-br from-surface-2 via-surface to-background">
            <Dumbbell className="h-9 w-9 text-gold/40" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted">{exercise.targetMuscle}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/60 to-transparent" />
        {exercise.videoUrl && (
          <span className="absolute bottom-2.5 left-3 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
            <PlayCircle className="h-3.5 w-3.5 text-gold" /> Video
          </span>
        )}
        <div className="absolute right-2.5 top-2.5 z-10">
          <FavoriteButton exercise={exercise} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-lg font-semibold uppercase leading-tight">
          <Link href={`/exercises/${exercise.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-[inherit]">
            {exercise.name}
          </Link>
        </h3>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-gold">
            <span className="sr-only">Target: </span>
            {exercise.targetMuscle}
          </span>
          {secondary.slice(0, 2).map((m) => (
            <span key={m} className="rounded-full border border-border px-2.5 py-0.5 text-muted">
              {m}
            </span>
          ))}
          {secondary.length > 2 && <span className="px-1 py-0.5 text-muted">+{secondary.length - 2}</span>}
        </div>
        {exercise.equipment.length > 0 && <p className="text-xs text-muted">{exercise.equipment.join(" · ")}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <DifficultyBadge difficulty={exercise.difficulty} />
          <span aria-hidden="true" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gold">
            {meta ?? "Details"} <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
