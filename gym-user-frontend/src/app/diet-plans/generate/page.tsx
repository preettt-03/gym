"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { generateDietPlan } from "@/lib/ai-api";
import type { GeneratedDietPlan } from "@/lib/ai-api";
import { DietPlanDetail } from "@/lib/diet-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";

function isSavedPlan(plan: GeneratedDietPlan | DietPlanDetail): plan is DietPlanDetail {
  return "id" in plan;
}

function GenerateContent() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [dietaryPreferences, setDietaryPreferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedDietPlan | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const result = await generateDietPlan({
        goal: goal || undefined,
        mealsPerDay,
        dietaryPreferences: dietaryPreferences
          ? dietaryPreferences.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        save: false,
      });
      setPreview(result.plan as GeneratedDietPlan);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to generate a plan. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateDietPlan({
        goal: goal || undefined,
        mealsPerDay,
        dietaryPreferences: dietaryPreferences
          ? dietaryPreferences.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        save: true,
      });
      if (isSavedPlan(result.plan)) {
        router.push(`/diet-plans/${result.plan.id}`);
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Failed to save the plan. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-2xl font-semibold"
      >
        <Sparkles className="h-6 w-6 text-accent" /> AI Diet Plan Generator
      </motion.h1>
      <p className="mt-1 text-muted">Tell it your goal and it will build a meal plan from the food library.</p>

      <Card className="mt-8 flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-muted">Goal (optional)</label>
          <Input placeholder="e.g. weight loss, muscle gain, maintenance" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Meals per day</label>
          <Input
            type="number"
            min={1}
            max={6}
            value={mealsPerDay}
            onChange={(e) => setMealsPerDay(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Dietary preferences (optional, comma-separated)</label>
          <Input
            placeholder="e.g. vegetarian, high protein"
            value={dietaryPreferences}
            onChange={(e) => setDietaryPreferences(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate preview"}
          </Button>
          <Link href="/diet-plans">
            <Button variant="glass" type="button">
              Back to plans
            </Button>
          </Link>
        </div>
      </Card>

      {preview && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <Card className="flex flex-col gap-4">
            <CardTitle>{preview.title}</CardTitle>
            {preview.description && <CardDescription>{preview.description}</CardDescription>}
            {preview.estimatedCalories && (
              <p className="text-xs text-muted">{preview.estimatedCalories} kcal/day estimated</p>
            )}

            <div className="flex flex-col gap-3">
              {preview.meals.map((meal, idx) => (
                <div key={idx} className="rounded-xl border border-foreground/10 p-3">
                  <div className="text-sm font-medium">
                    {meal.mealType} {meal.title ? `— ${meal.title}` : ""}
                  </div>
                  <ul className="mt-1 list-inside list-disc text-xs text-muted">
                    {meal.items.map((item, itemIdx) => (
                      <li key={itemIdx}>
                        {item.foodName ?? "Food"} — {item.quantityGrams}g
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save this plan"}
            </Button>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default function GenerateDietPlanPage() {
  return (
    <RequireAuth>
      <GenerateContent />
    </RequireAuth>
  );
}
