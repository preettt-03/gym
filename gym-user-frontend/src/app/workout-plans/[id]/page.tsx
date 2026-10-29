"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, CheckCircle2, Clock, Flame, Loader2, Moon, Repeat } from "lucide-react";
import { completeWorkoutDay, getWorkoutPlan, type WorkoutPlanDay, type WorkoutPlanExerciseEntry } from "@/lib/workout-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyBadge } from "@/components/exercise/exercise-card";
import { ErrorNote, MemberPage, SegmentedTabs } from "@/components/member/ui";

function targetText(e: WorkoutPlanExerciseEntry) {
  const parts: string[] = [];
  if (e.targetSets && e.targetReps) parts.push(`${e.targetSets} × ${e.targetReps}`);
  else if (e.targetSets) parts.push(`${e.targetSets} sets`);
  if (e.targetWeightKg) parts.push(`${e.targetWeightKg} kg`);
  if (e.targetDurationSeconds) parts.push(e.targetDurationSeconds >= 60 ? `${Math.round(e.targetDurationSeconds / 60)} min` : `${e.targetDurationSeconds}s`);
  if (e.targetDistanceMeters) parts.push(e.targetDistanceMeters >= 1000 ? `${e.targetDistanceMeters / 1000} km` : `${e.targetDistanceMeters} m`);
  return parts.join(" · ");
}

function DayCard({ planId, day }: { planId: string; day: WorkoutPlanDay }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const mutation = useMutation({
    mutationFn: () => completeWorkoutDay(day.id, notes.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-plan", planId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setShowNotes(false);
    },
  });
  const name = day.title ?? `Day ${day.dayNumber}`;

  if (day.isRestDay) {
    return (
      <article className="glass-card flex items-center gap-4 p-5 opacity-80">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
          <Moon className="h-5 w-5 text-muted" />
        </span>
        <div>
          <h3 className="font-semibold uppercase">{name}</h3>
          <p className="text-sm text-muted">Rest day — recovery is part of the plan.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="glass-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Day {day.dayNumber}</p>
          <h3 className="text-lg font-semibold uppercase">{name}</h3>
        </div>
        {mutation.isSuccess ? (
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Logged
          </span>
        ) : (
          <div className="flex gap-2">
            {!showNotes && (
              <Button variant="glass" size="sm" onClick={() => setShowNotes(true)}>
                Add notes
              </Button>
            )}
            <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark complete
            </Button>
          </div>
        )}
      </div>

      {showNotes && !mutation.isSuccess && (
        <div>
          <label htmlFor={`notes-${day.id}`} className="mb-1.5 block text-sm font-medium">
            How did it go? <span className="text-xs font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={`notes-${day.id}`}
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Felt strong, added 2.5 kg on squats."
            className="glass-input w-full resize-y px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-gold/60"
          />
        </div>
      )}
      {mutation.isError && (
        <ErrorNote>{isAxiosError(mutation.error) ? mutation.error.response?.data?.error?.message ?? "Could not log this workout." : "Could not log this workout."}</ErrorNote>
      )}

      <ol className="flex flex-col gap-2">
        {day.exercises
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((entry, i) => (
            <li key={entry.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-sm text-gold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {entry.exercise.slug ? (
                    <Link href={`/exercises/${entry.exercise.slug}`} className="hover:text-gold">
                      {entry.exercise.name}
                    </Link>
                  ) : (
                    entry.exercise.name
                  )}
                  {entry.isSwapped && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-gold">
                      <Repeat className="h-3 w-3" /> swapped
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {entry.exercise.targetMuscle}
                  {entry.notes && ` · ${entry.notes}`}
                </p>
              </div>
              {targetText(entry) && <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{targetText(entry)}</span>}
            </li>
          ))}
      </ol>
    </article>
  );
}

function WorkoutPlanDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isPending, isError } = useQuery({ queryKey: ["workout-plan", id], queryFn: () => getWorkoutPlan(id) });
  const weeks = plan ? [...new Set(plan.days.map((d) => d.weekNumber))].sort((a, b) => a - b) : [];
  const [week, setWeek] = useState<string | null>(null);
  const activeWeek = week ?? String(weeks[0] ?? 1);
  const days = plan?.days.filter((d) => String(d.weekNumber) === activeWeek).sort((a, b) => a.dayNumber - b.dayNumber) ?? [];
  const trainingDays = plan?.days.filter((d) => !d.isRestDay && d.weekNumber === Number(activeWeek)).length ?? 0;

  return (
    <MemberPage className="max-w-4xl">
      <Link href="/workout-plans" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Workout plans
      </Link>

      {isPending && (
        <div className="mt-6 flex flex-col gap-4" aria-label="Loading plan">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      )}
      {isError && (
        <div className="mt-6">
          <ErrorNote>Could not load this plan. It may have been removed or isn&apos;t assigned to you.</ErrorNote>
        </div>
      )}

      {plan && (
        <>
          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <DifficultyBadge difficulty={plan.difficulty} />
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">{plan.source === "ADMIN" ? "Coach program" : "Your plan"}</span>
            </div>
            <h1 className="mt-3 text-4xl font-bold uppercase leading-tight">{plan.title}</h1>
            {plan.description && <p className="mt-2 max-w-2xl text-foreground/75">{plan.description}</p>}
            <dl className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
              {plan.estimatedMinutes && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gold" />
                  <dt className="sr-only">Session length</dt>
                  <dd>{plan.estimatedMinutes} min / session</dd>
                </div>
              )}
              {plan.estimatedCalories && (
                <div className="flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-gold" />
                  <dt className="sr-only">Calories</dt>
                  <dd>~{plan.estimatedCalories} kcal</dd>
                </div>
              )}
              <div>
                <dt className="sr-only">Training days</dt>
                <dd>{trainingDays} training days this week</dd>
              </div>
            </dl>
          </header>

          {weeks.length > 1 && (
            <div className="mt-6">
              <SegmentedTabs label="Week" value={activeWeek} onChange={setWeek} tabs={weeks.map((w) => ({ key: String(w), label: `Week ${w}` }))} />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4">
            {days.length === 0 ? (
              <p className="text-muted">No days in this week.</p>
            ) : (
              days.map((day) => <DayCard key={day.id} planId={plan.id} day={day} />)
            )}
          </div>
        </>
      )}
    </MemberPage>
  );
}

export default function WorkoutPlanDetailPage() {
  return (
    <RequireAuth>
      <WorkoutPlanDetailContent />
    </RequireAuth>
  );
}
