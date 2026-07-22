"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getDietPlan, DietPlanMeal, MealType } from "@/lib/diet-api";
import { Card, CardDescription } from "@/components/ui/card";
import { RequireAuth } from "@/components/require-auth";

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACKS: "Snacks",
  PRE_WORKOUT: "Pre-workout",
  POST_WORKOUT: "Post-workout",
};

function MealCard({ meal }: { meal: DietPlanMeal }) {
  const mealCalories = meal.items.reduce((sum, item) => sum + item.nutrition.calories, 0);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{meal.title ?? MEAL_LABELS[meal.mealType]}</div>
        <span className="text-xs text-muted">{Math.round(mealCalories)} kcal</span>
      </div>
      <div className="flex flex-col gap-2">
        {meal.items.map((item) => (
          <div key={item.id} className="glass-input flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm font-medium">{item.food.name}</div>
              <div className="text-xs text-muted">{item.quantityGrams}g</div>
            </div>
            <div className="text-right text-xs text-muted">
              <div>{item.nutrition.calories} kcal</div>
              <div>{item.nutrition.protein}g protein</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DietPlanDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isLoading, isError } = useQuery({
    queryKey: ["diet-plan", id],
    queryFn: () => getDietPlan(id),
  });

  const totalCalories = plan?.meals.reduce(
    (sum, meal) => sum + meal.items.reduce((s, item) => s + item.nutrition.calories, 0),
    0
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {isLoading && <p className="text-muted">Loading plan...</p>}
      {isError && <p className="text-danger">Could not load this plan.</p>}

      {plan && (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-semibold">{plan.title}</h1>
            {plan.description && <CardDescription className="mt-1">{plan.description}</CardDescription>}
            <div className="mt-3 flex gap-3 text-sm text-muted">
              <span>{Math.round(totalCalories ?? 0)} kcal total</span>
              {plan.categories.map((c) => (
                <span key={c.id} className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs text-accent">
                  {c.name}
                </span>
              ))}
            </div>
          </motion.div>

          <div className="mt-8 flex flex-col gap-4">
            {plan.meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DietPlanDetailPage() {
  return (
    <RequireAuth>
      <DietPlanDetailContent />
    </RequireAuth>
  );
}
