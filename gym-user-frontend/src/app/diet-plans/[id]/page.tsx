"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Flame, Loader2, Plus } from "lucide-react";
import { getDietPlan, logFood, MEAL_LABELS, MEAL_ORDER, type DietPlanMeal } from "@/lib/diet-api";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, MemberPage, Tile } from "@/components/member/ui";

const sum = (meal: DietPlanMeal, key: "calories" | "protein" | "carbs" | "fat") =>
  meal.items.reduce((s, i) => s + (i.nutrition[key] ?? 0), 0);

function MealCard({ meal }: { meal: DietPlanMeal }) {
  const queryClient = useQueryClient();
  const [logged, setLogged] = useState(false);

  // Adds every item of this meal to today's nutrition log.
  const log = useMutation({
    mutationFn: async () => {
      for (const item of meal.items) {
        await logFood({ foodId: item.food.id, quantityGrams: item.quantityGrams, mealType: meal.mealType });
      }
    },
    onSuccess: () => {
      setLogged(true);
      queryClient.invalidateQueries({ queryKey: ["daily-nutrition"] });
    },
  });

  return (
    <article className="glass-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{MEAL_LABELS[meal.mealType]}</p>
          <h3 className="mt-1 text-lg font-semibold uppercase">{meal.title ?? MEAL_LABELS[meal.mealType]}</h3>
          <p className="text-sm text-muted">
            {Math.round(sum(meal, "calories"))} kcal · P {Math.round(sum(meal, "protein"))} g · C {Math.round(sum(meal, "carbs"))} g · F{" "}
            {Math.round(sum(meal, "fat"))} g
          </p>
        </div>
        {logged ? (
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Added to today
          </span>
        ) : (
          <Button size="sm" variant="outline" disabled={log.isPending || meal.items.length === 0} onClick={() => log.mutate()}>
            {log.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Log this meal
          </Button>
        )}
      </div>
      {log.isError && <ErrorNote>Some items couldn&apos;t be logged. Check today&apos;s log on the Nutrition page before trying again.</ErrorNote>}
      <ul className="flex flex-col gap-2">
        {meal.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.food.name}</p>
              <p className="text-xs text-muted">
                {item.quantityGrams} g{item.notes && ` · ${item.notes}`}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-muted">
              <p className="text-sm font-semibold text-foreground">{Math.round(item.nutrition.calories)} kcal</p>
              <p>{Math.round(item.nutrition.protein)} g protein</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function DietPlanDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isPending, isError } = useQuery({ queryKey: ["diet-plan", id], queryFn: () => getDietPlan(id) });
  const meals = plan?.meals.slice().sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType)) ?? [];
  const total = (key: "calories" | "protein" | "carbs" | "fat") => meals.reduce((s, m) => s + sum(m, key), 0);
  const macroKcal = total("protein") * 4 + total("carbs") * 4 + total("fat") * 9;
  const pct = (kcal: number) => (macroKcal ? Math.round((kcal / macroKcal) * 100) : 0);

  return (
    <MemberPage className="max-w-4xl">
      <Link href="/diet-plans" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Diet plans
      </Link>

      {isPending && (
        <div className="mt-6 flex flex-col gap-4" aria-label="Loading plan">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
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
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">{plan.source === "ADMIN" ? "Coach plan" : "Your plan"}</span>
              {plan.categories.map((c) => (
                <span key={c.id} className="rounded-full border border-gold/40 px-2.5 py-0.5 text-xs text-gold">
                  {c.name}
                </span>
              ))}
            </div>
            <h1 className="mt-3 text-4xl font-bold uppercase leading-tight">{plan.title}</h1>
            {plan.description && <p className="mt-2 max-w-2xl text-foreground/75">{plan.description}</p>}
          </header>

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile icon={Flame} label="Calories" value={`${Math.round(total("calories"))} kcal`} sub="Whole day" />
            <Tile icon={Flame} label="Protein" value={`${Math.round(total("protein"))} g`} sub={`${pct(total("protein") * 4)}% of energy`} />
            <Tile icon={Flame} label="Carbs" value={`${Math.round(total("carbs"))} g`} sub={`${pct(total("carbs") * 4)}% of energy`} />
            <Tile icon={Flame} label="Fat" value={`${Math.round(total("fat"))} g`} sub={`${pct(total("fat") * 9)}% of energy`} />
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {meals.length === 0 ? <p className="text-muted">This plan has no meals yet.</p> : meals.map((m) => <MealCard key={m.id} meal={m} />)}
          </div>
          <p className="mt-6 text-xs text-muted">Nutrition values come from our food database and are estimates per serving.</p>
        </>
      )}
    </MemberPage>
  );
}

export default function DietPlanDetailPage() {
  return (
    <RequireAuth>
      <DietPlanDetailContent />
    </RequireAuth>
  );
}
