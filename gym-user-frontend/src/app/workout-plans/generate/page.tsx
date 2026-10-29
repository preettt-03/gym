"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info, Loader2, Moon, RefreshCw, Save, Sparkles } from "lucide-react";
import { generateWorkoutPlan, type GeneratedWorkoutPlan } from "@/lib/ai-api";
import { createWorkoutPlan } from "@/lib/workout-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DifficultyBadge } from "@/components/exercise/exercise-card";
import { ErrorNote, MemberHeader, MemberPage } from "@/components/member/ui";
import { AiThinking, ChoiceChips, aiErrorMessage } from "@/components/member/ai-form";
import { cn } from "@/lib/utils";

const GOALS = [
  { value: "Build muscle", label: "Build muscle" },
  { value: "Lose fat", label: "Lose fat" },
  { value: "Get stronger", label: "Get stronger" },
  { value: "Improve endurance", label: "Endurance" },
  { value: "General fitness", label: "General fitness" },
];
const FOCUS = ["Legs", "Glutes", "Chest", "Back", "Shoulders", "Arms", "Core", "Full body"].map((v) => ({ value: v, label: v }));
const EQUIPMENT = ["Barbell", "Dumbbells", "Kettlebell", "Cable machine", "Pull-up bar", "Bench", "Resistance bands"].map((v) => ({ value: v, label: v }));
const DURATIONS = [30, 45, 60, 75, 90];

function GenerateContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [minutes, setMinutes] = useState<number | undefined>(60);
  const [focus, setFocus] = useState<string[]>([]);
  const [fullGym, setFullGym] = useState(true);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [limitations, setLimitations] = useState("");

  const generate = useMutation({
    mutationFn: async () => {
      const result = await generateWorkoutPlan({
        goal: customGoal.trim() || goal[0] || undefined,
        daysPerWeek,
        focusAreas: focus.length ? focus : undefined,
        sessionMinutes: minutes,
        equipment: fullGym ? undefined : equipment,
        limitations: limitations.trim() || undefined,
        save: false,
      });
      return result.plan as GeneratedWorkoutPlan;
    },
  });

  // Saves exactly the plan on screen — no second AI call that could differ.
  const save = useMutation({
    mutationFn: (plan: GeneratedWorkoutPlan) => createWorkoutPlan(plan),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["workout-plans"] });
      router.push(`/workout-plans/${saved.id}`);
    },
  });

  const preview = generate.data;
  const noEquipmentChosen = !fullGym && equipment.length === 0;

  return (
    <MemberPage className="max-w-4xl">
      <Link href="/workout-plans" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Workout plans
      </Link>
      <div className="mt-6">
        <MemberHeader
          eyebrow="AI coach"
          title="Build a workout plan"
          description="Answer a few questions and the AI designs a week of training from our exercise library. You can review it before saving."
        />
      </div>

      <form
        noValidate
        className="glass-card mt-8 flex flex-col gap-6 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!noEquipmentChosen) generate.mutate();
        }}
      >
        <div className="flex flex-col gap-3">
          <ChoiceChips label="Your main goal" options={GOALS} value={goal} onChange={(v) => (setGoal(v), setCustomGoal(""))} />
          <div>
            <label htmlFor="custom-goal" className="sr-only">
              Or describe your goal
            </label>
            <Input
              id="custom-goal"
              maxLength={200}
              placeholder="…or describe it, e.g. run a 10K while keeping my strength"
              value={customGoal}
              onChange={(e) => (setCustomGoal(e.target.value), setGoal([]))}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Training days per week</legend>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={daysPerWeek === n}
                  onClick={() => setDaysPerWeek(n)}
                  className={cn(
                    "h-10 w-10 rounded-xl border text-sm font-semibold transition-colors",
                    daysPerWeek === n ? "border-gold bg-gold text-accent-foreground" : "border-border text-muted hover:text-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <ChoiceChips
            label="Session length"
            options={DURATIONS.map((d) => ({ value: String(d), label: `${d} min` }))}
            value={minutes ? [String(minutes)] : []}
            onChange={(v) => setMinutes(v[0] ? Number(v[0]) : undefined)}
          />
        </div>

        <ChoiceChips label="Focus areas (optional)" options={FOCUS} value={focus} onChange={setFocus} multiple />

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={fullGym} onChange={(e) => setFullGym(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
            I train at King&apos;s Fitness (full gym equipment)
          </label>
          {!fullGym && (
            <>
              <ChoiceChips label="Equipment you have" options={EQUIPMENT} value={equipment} onChange={setEquipment} multiple />
              {noEquipmentChosen && <p className="text-xs text-muted">Pick at least one, or the plan will use bodyweight only — tick the box above for the full gym.</p>}
            </>
          )}
        </div>

        <div>
          <label htmlFor="limitations" className="mb-1.5 block text-sm font-medium">
            Injuries or limitations <span className="text-xs font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="limitations"
            rows={2}
            maxLength={300}
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            placeholder="e.g. lower-back pain, can't kneel, recovering from a shoulder injury"
            className="glass-input w-full resize-y px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
          />
        </div>

        <p className="flex gap-2 text-xs text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> AI plans are general guidance. If you have a medical condition or pain, check with a doctor or one of our
          coaches before starting.
        </p>

        <Button type="submit" disabled={generate.isPending || save.isPending} className="self-start uppercase tracking-wider">
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {preview ? "Generate again" : "Generate plan"}
        </Button>
      </form>

      <div className="mt-8" aria-live="polite">
        {generate.isPending && <AiThinking label="Designing your week…" />}
        {generate.isError && !generate.isPending && <ErrorNote>{aiErrorMessage(generate.error)}</ErrorNote>}

        {preview && !generate.isPending && (
          <section className="glass-card flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Preview</p>
                <h2 className="mt-2 text-2xl font-bold uppercase">{preview.title}</h2>
                {preview.description && <p className="mt-1 text-sm text-muted">{preview.description}</p>}
              </div>
              <DifficultyBadge difficulty={preview.difficulty} />
            </div>

            <ol className="grid gap-3 md:grid-cols-2">
              {preview.days
                .slice()
                .sort((a, b) => a.dayNumber - b.dayNumber)
                .map((day) => (
                  <li key={`${day.weekNumber}-${day.dayNumber}`} className="rounded-xl bg-surface-2 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold uppercase">
                      {day.isRestDay && <Moon className="h-4 w-4 text-muted" />}
                      Day {day.dayNumber}
                      {day.title && <span className="font-normal normal-case text-muted">· {day.title}</span>}
                    </p>
                    {day.isRestDay ? (
                      <p className="mt-1 text-sm text-muted">Rest &amp; recovery</p>
                    ) : day.exercises.length === 0 ? (
                      <p className="mt-1 text-sm text-muted">No exercises — try generating again.</p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                        {day.exercises.map((ex, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="truncate">{ex.exerciseName ?? "Exercise"}</span>
                            <span className="shrink-0 tabular-nums text-muted">
                              {ex.targetSets ?? "—"} × {ex.targetReps ?? "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
            </ol>

            {save.isError && <ErrorNote>{aiErrorMessage(save.error)}</ErrorNote>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={save.isPending} onClick={() => save.mutate(preview)} className="uppercase tracking-wider">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save this plan
              </Button>
              <Button variant="glass" disabled={generate.isPending || save.isPending} onClick={() => generate.mutate()}>
                <RefreshCw className="h-4 w-4" /> Try a different plan
              </Button>
            </div>
          </section>
        )}
      </div>
    </MemberPage>
  );
}

export default function GenerateWorkoutPlanPage() {
  return (
    <RequireAuth>
      <GenerateContent />
    </RequireAuth>
  );
}
