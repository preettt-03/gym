"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertTriangle, ArrowLeft, Dumbbell, Flame, ListOrdered, Sparkles, Target, Timer } from "lucide-react";
import { getExercise } from "@/lib/exercise-api";
import { DifficultyBadge } from "@/components/exercise/exercise-card";
import { FavoriteButton } from "@/components/exercise/favorite-button";
import { FormTipButton } from "@/components/exercise/form-tip-button";
import { MediaShowcase } from "@/components/exercise/media-player";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading exercise">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10">
        <Icon className="h-4 w-4 text-gold" />
      </span>
      <div>
        <dt className="text-xs uppercase tracking-widest text-muted">{label}</dt>
        <dd className="mt-0.5 text-sm">{value}</dd>
      </div>
    </div>
  );
}

export default function ExerciseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));

  const { data: exercise, isPending, error } = useQuery({
    queryKey: ["exercise", slug, isAuthed],
    queryFn: async () => {
      const result = await getExercise(slug);
      // Opening an exercise records a view server-side; refresh the recent list.
      if (isAuthed) queryClient.invalidateQueries({ queryKey: ["exercise-recent"] });
      return result;
    },
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 1,
  });

  const notFound = isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/exercises" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Exercise library
      </Link>

      <div className="mt-6">
        {isPending && <DetailSkeleton />}

        {error && (
          <div role="alert" className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <p className="font-medium">{notFound ? "This exercise doesn't exist or was removed." : "Could not load this exercise."}</p>
            <Link href="/exercises" className="mt-3 inline-block text-sm font-semibold text-gold hover:underline">
              Back to the library
            </Link>
          </div>
        )}

        {exercise && (
          <article>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <DifficultyBadge difficulty={exercise.difficulty} />
                  {exercise.categories.map((c) => (
                    <span key={c.id} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
                      {c.name}
                    </span>
                  ))}
                </div>
                <h1 className="mt-3 text-4xl font-bold uppercase leading-tight sm:text-5xl">{exercise.name}</h1>
                {exercise.description && <p className="mt-3 max-w-2xl text-lg text-foreground/75">{exercise.description}</p>}
              </div>
              <FavoriteButton exercise={exercise} size="lg" />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
              <MediaShowcase name={exercise.name} targetMuscle={exercise.targetMuscle} media={exercise.media} />

              <aside className="flex flex-col gap-3" aria-label="Exercise specs">
                <section className="rounded-2xl bg-linear-to-br from-gold-light via-gold to-gold-dark p-5 text-accent-foreground shadow-[0_0_25px_rgba(229,192,123,0.2)]">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] opacity-75">
                    <Target className="h-3.5 w-3.5" /> Primary muscle
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold uppercase">{exercise.targetMuscle}</p>
                  <p className="mt-1 text-xs opacity-80">Does most of the work through every rep.</p>
                </section>
                <section className="glass-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Secondary / assisting</p>
                  {exercise.secondaryMuscles.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {exercise.secondaryMuscles.map((m) => (
                        <li key={m} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-sm">
                          {m}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Mostly isolates the primary muscle.</p>
                  )}
                </section>
                <section className="glass-card p-5">
                  <dl className="flex flex-col gap-4">
                    <Fact icon={Dumbbell} label="Equipment" value={exercise.equipment.length ? exercise.equipment.join(", ") : "None — bodyweight"} />
                    {exercise.durationMinutes ? <Fact icon={Timer} label="Duration" value={`${exercise.durationMinutes} min`} /> : null}
                    {exercise.caloriesBurnedEstimate ? <Fact icon={Flame} label="Estimated burn" value={`~${exercise.caloriesBurnedEstimate} kcal`} /> : null}
                  </dl>
                </section>
              </aside>
            </div>

            <h2 className="mt-10 text-2xl font-bold uppercase">Details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <section className="glass-card p-6">
                <h3 className="flex items-center gap-2 text-xl font-semibold uppercase">
                  <ListOrdered className="h-5 w-5 text-gold" /> How to do it
                </h3>
                {exercise.instructions.length > 0 ? (
                  <ol className="mt-4 flex flex-col gap-4">
                    {exercise.instructions.map((step, i) => (
                      <li key={i} className="flex gap-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-display text-sm font-bold text-accent-foreground">
                          {i + 1}
                        </span>
                        <span className="pt-0.5 leading-relaxed text-foreground/85">{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-muted">Step-by-step instructions haven&apos;t been added yet.</p>
                )}
              </section>

              <section className="glass-card p-6">
                <h3 className="flex items-center gap-2 text-xl font-semibold uppercase">
                  <AlertTriangle className="h-5 w-5 text-[#fab219]" /> Common mistakes
                </h3>
                {exercise.commonMistakes.length > 0 ? (
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {exercise.commonMistakes.map((m, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm leading-relaxed text-foreground/85">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#fab219]" aria-hidden />
                        {m}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">No common mistakes listed yet.</p>
                )}
              </section>
            </div>

            <section className="relative mt-4 overflow-hidden rounded-2xl bg-linear-to-br from-gold-light via-gold to-gold-dark p-6 text-accent-foreground shadow-[0_20px_60px_-20px] shadow-gold/40">
              <Sparkles className="absolute -right-2 -top-2 h-20 w-20 opacity-15" aria-hidden />
              <h2 className="font-display text-2xl font-bold uppercase">Coach&apos;s tip</h2>
              {exercise.coachTip && <p className="mt-2 max-w-3xl text-base leading-relaxed">{exercise.coachTip}</p>}
              <div className="mt-4 rounded-xl bg-background/90 p-4 text-foreground">
                {isAuthed ? (
                  <FormTipButton exerciseId={exercise.id} />
                ) : (
                  <p className="text-sm text-muted">
                    <Link href="/login" className="font-semibold text-gold hover:underline">
                      Log in
                    </Link>{" "}
                    to get an AI form tip tailored to you.
                  </p>
                )}
              </div>
            </section>
          </article>
        )}
      </div>
    </div>
  );
}
