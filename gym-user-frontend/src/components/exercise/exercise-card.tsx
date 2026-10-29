import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import type { Exercise } from "@/lib/api";
import { FavoriteButton } from "@/components/exercise/favorite-button";
import { MuscleSilhouette } from "@/components/exercise/muscle-silhouette";
import { muscleGroupOf } from "@/lib/muscles";
import { cn } from "@/lib/utils";

const DIFFICULTY_STYLE: Record<Exercise["difficulty"], string> = {
  BEGINNER: "border-success/40 text-success",
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
  const secondary = exercise.secondaryMuscles ?? [];
  const steps = exercise.instructions?.length ?? 0;

  return (
    <article className="glass-card group relative flex h-full flex-col overflow-hidden transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_0_15px_rgba(229,192,123,0.15)] focus-within:border-gold/60">
      <div className="relative aspect-video overflow-hidden rounded-t-[inherit] bg-surface-2">
        {exercise.thumbnailUrl ? (
          // Exercise media is admin-uploaded and served from the API host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={exercise.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <MuscleSilhouette group={muscleGroupOf(exercise.targetMuscle)} label={`${exercise.targetMuscle} diagram`} className="transition-transform duration-300 group-hover:scale-105" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/30" />
        <span className={cn("absolute left-3 top-3 rounded-full border bg-black/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur", DIFFICULTY_STYLE[exercise.difficulty])}>
          {difficultyLabel(exercise.difficulty)}
        </span>
        {exercise.videoCount > 0 && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-black/75 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <Play className="h-3 w-3 fill-gold text-gold" />
            {exercise.videoCount === 1 ? "Video available" : `${exercise.videoCount} videos`}
          </span>
        )}
        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton exercise={exercise} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <h3 className="text-lg font-semibold uppercase leading-tight">
          <Link href={`/exercises/${exercise.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-[inherit]">
            {exercise.name}
          </Link>
        </h3>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          Target:
          <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 font-semibold text-gold-light">{exercise.targetMuscle}</span>
        </p>
        {secondary.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            Also works:
            {secondary.slice(0, 3).map((m) => (
              <span key={m} className="rounded-md bg-surface-2 px-2 py-0.5 text-foreground/80">
                {m}
              </span>
            ))}
            {secondary.length > 3 && <span>+{secondary.length - 3}</span>}
          </p>
        )}
        {exercise.equipment.length > 0 && <p className="text-xs text-muted">{exercise.equipment.join(" • ")}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-[11px] text-muted">{meta ?? (steps ? `${steps} step${steps === 1 ? "" : "s"}` : "Guide coming soon")}</span>
          <span aria-hidden="true" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gold">
            View details <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
