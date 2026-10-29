"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertTriangle, ArrowLeft, CheckCircle2, Dumbbell, Flame, PlayCircle, Target, Timer } from "lucide-react";
import { getExercise } from "@/lib/exercise-api";
import { DifficultyBadge } from "@/components/exercise/exercise-card";
import { FavoriteButton } from "@/components/exercise/favorite-button";
import { FormTipButton } from "@/components/exercise/form-tip-button";
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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
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

            <div className="mt-8 grid gap-6 md:grid-cols-[2fr_1fr]">
              <div className="flex flex-col gap-6">
                {exercise.gifUrl || exercise.images[0] ? (
                  // Exercise media is admin-uploaded and can live on any host.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={exercise.gifUrl || exercise.images[0]}
                    alt={`${exercise.name} demonstration`}
                    loading="lazy"
                    className="aspect-video w-full rounded-2xl border border-border object-cover"
                  />
                ) : null}

                <section className="glass-card p-6">
                  <h2 className="text-xl font-semibold uppercase">How to do it</h2>
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

                {exercise.commonMistakes.length > 0 && (
                  <section className="glass-card p-6">
                    <h2 className="text-xl font-semibold uppercase">Common mistakes</h2>
                    <ul className="mt-4 flex flex-col gap-3">
                      {exercise.commonMistakes.map((m, i) => (
                        <li key={i} className="flex gap-3 text-foreground/85">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#fab219]" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="glass-card p-6">
                  <h2 className="text-xl font-semibold uppercase">Coach&apos;s tip</h2>
                  <div className="mt-4">
                    {isAuthed ? (
                      <FormTipButton exerciseId={exercise.id} />
                    ) : (
                      <p className="text-sm text-muted">
                        <Link href="/login" className="font-semibold text-gold hover:underline">
                          Log in
                        </Link>{" "}
                        to get an AI form tip tailored to this exercise.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <aside className="glass-card h-fit p-6">
                <dl className="flex flex-col gap-5">
                  <Fact icon={Target} label="Target muscle" value={exercise.targetMuscle} />
                  {exercise.secondaryMuscles.length > 0 && (
                    <Fact icon={CheckCircle2} label="Also works" value={exercise.secondaryMuscles.join(", ")} />
                  )}
                  <Fact icon={Dumbbell} label="Equipment" value={exercise.equipment.length ? exercise.equipment.join(", ") : "None — bodyweight"} />
                  {exercise.durationMinutes && <Fact icon={Timer} label="Duration" value={`${exercise.durationMinutes} min`} />}
                  {exercise.caloriesBurnedEstimate && (
                    <Fact icon={Flame} label="Estimated burn" value={`~${exercise.caloriesBurnedEstimate} kcal`} />
                  )}
                </dl>
                {exercise.videoUrl && (
                  <a
                    href={exercise.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-gold/50 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold hover:text-accent-foreground"
                  >
                    <PlayCircle className="h-4 w-4" /> Watch video
                  </a>
                )}
              </aside>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
