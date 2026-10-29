"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info, Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { generateDietPlan, type GeneratedDietPlan } from "@/lib/ai-api";
import { createDietPlan, MEAL_LABELS, type MealType } from "@/lib/diet-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote, MemberHeader, MemberPage } from "@/components/member/ui";
import { AiThinking, ChoiceChips, aiErrorMessage } from "@/components/member/ai-form";
import { cn } from "@/lib/utils";

const GOALS = ["Lose fat", "Build muscle", "Maintain weight", "More energy", "Eat healthier"].map((v) => ({ value: v, label: v }));
const PREFERENCES = ["Vegetarian", "Eggetarian", "Vegan", "Jain", "High protein", "Low carb", "No dairy", "Gluten free"].map((v) => ({ value: v, label: v }));

function GenerateDietContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [prefs, setPrefs] = useState<string[]>([]);
  const [otherPrefs, setOtherPrefs] = useState("");

  const generate = useMutation({
    mutationFn: async () => {
      const extra = otherPrefs.split(",").map((s) => s.trim()).filter(Boolean);
      const result = await generateDietPlan({
        goal: customGoal.trim() || goal[0] || undefined,
        mealsPerDay,
        dietaryPreferences: [...prefs, ...extra].slice(0, 10),
        save: false,
      });
      return result.plan as GeneratedDietPlan;
    },
  });

  // Saves exactly the plan on screen — no second AI call that could differ.
  const save = useMutation({
    mutationFn: (plan: GeneratedDietPlan) => createDietPlan(plan),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["diet-plans"] });
      router.push(`/diet-plans/${saved.id}`);
    },
  });

  const preview = generate.data;

  return (
    <MemberPage className="max-w-4xl">
      <Link href="/diet-plans" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Diet plans
      </Link>
      <div className="mt-6">
        <MemberHeader
          eyebrow="AI coach"
          title="Build a meal plan"
          description="The AI plans a day of meals from our food database using your profile, goal and preferences. Review it before saving."
        />
      </div>

      <form
        noValidate
        className="glass-card mt-8 flex flex-col gap-6 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          generate.mutate();
        }}
      >
        <div className="flex flex-col gap-3">
          <ChoiceChips label="Your goal" options={GOALS} value={goal} onChange={(v) => (setGoal(v), setCustomGoal(""))} />
          <label htmlFor="diet-goal" className="sr-only">
            Or describe your goal
          </label>
          <Input
            id="diet-goal"
            maxLength={200}
            placeholder="…or describe it, e.g. 2,000 kcal with 140 g protein"
            value={customGoal}
            onChange={(e) => (setCustomGoal(e.target.value), setGoal([]))}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Meals per day</legend>
          <div className="flex flex-wrap gap-1.5">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={mealsPerDay === n}
                onClick={() => setMealsPerDay(n)}
                className={cn(
                  "h-10 w-10 rounded-xl border text-sm font-semibold transition-colors",
                  mealsPerDay === n ? "border-gold bg-gold text-accent-foreground" : "border-border text-muted hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <ChoiceChips label="Dietary preferences (optional)" options={PREFERENCES} value={prefs} onChange={setPrefs} multiple />
        <div>
          <label htmlFor="other-prefs" className="mb-1.5 block text-sm font-medium">
            Allergies or foods to avoid <span className="text-xs font-normal text-muted">(comma-separated)</span>
          </label>
          <Input id="other-prefs" maxLength={200} placeholder="e.g. peanuts, mushrooms" value={otherPrefs} onChange={(e) => setOtherPrefs(e.target.value)} />
        </div>

        <p className="flex gap-2 text-xs text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> AI meal plans are general guidance and use estimated nutrition values. For medical diets or
          allergies, double-check with a doctor or dietitian.
        </p>

        <Button type="submit" disabled={generate.isPending || save.isPending} className="self-start uppercase tracking-wider">
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {preview ? "Generate again" : "Generate plan"}
        </Button>
      </form>

      <div className="mt-8" aria-live="polite">
        {generate.isPending && <AiThinking label="Planning your meals…" />}
        {generate.isError && !generate.isPending && <ErrorNote>{aiErrorMessage(generate.error)}</ErrorNote>}

        {preview && !generate.isPending && (
          <section className="glass-card flex flex-col gap-5 p-6">
            <div>
              <p className="eyebrow">Preview</p>
              <h2 className="mt-2 text-2xl font-bold uppercase">{preview.title}</h2>
              {preview.description && <p className="mt-1 text-sm text-muted">{preview.description}</p>}
              {preview.estimatedCalories && <p className="mt-2 text-sm font-semibold text-gold">~{preview.estimatedCalories} kcal for the day</p>}
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {preview.meals.map((meal, i) => (
                <li key={i} className="rounded-xl bg-surface-2 p-4">
                  <p className="text-sm font-semibold uppercase">
                    {meal.title || MEAL_LABELS[meal.mealType as MealType] || meal.mealType}
                    {meal.title && <span className="ml-2 text-xs font-normal normal-case text-muted">{MEAL_LABELS[meal.mealType as MealType]}</span>}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                    {meal.items.map((item, j) => (
                      <li key={j} className="flex justify-between gap-3">
                        <span className="truncate">{item.foodName ?? "Food"}</span>
                        <span className="shrink-0 tabular-nums text-muted">{Math.round(item.quantityGrams)} g</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
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

export default function GenerateDietPlanPage() {
  return (
    <RequireAuth>
      <GenerateDietContent />
    </RequireAuth>
  );
}
