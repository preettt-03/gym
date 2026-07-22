"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { generateWorkoutPlan } from "@/lib/ai-api";
import type { GeneratedWorkoutPlan } from "@/lib/ai-api";
import { WorkoutPlanDetail } from "@/lib/workout-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";

function isSavedPlan(plan: GeneratedWorkoutPlan | WorkoutPlanDetail): plan is WorkoutPlanDetail {
  return "id" in plan;
}

function GenerateContent() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [focusAreas, setFocusAreas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedWorkoutPlan | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const result = await generateWorkoutPlan({
        goal: goal || undefined,
        daysPerWeek,
        focusAreas: focusAreas
          ? focusAreas.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        save: false,
      });
      setPreview(result.plan as GeneratedWorkoutPlan);
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
      const result = await generateWorkoutPlan({
        goal: goal || undefined,
        daysPerWeek,
        focusAreas: focusAreas
          ? focusAreas.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        save: true,
      });
      if (isSavedPlan(result.plan)) {
        router.push(`/workout-plans/${result.plan.id}`);
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
        <Sparkles className="h-6 w-6 text-accent" /> AI Workout Plan Generator
      </motion.h1>
      <p className="mt-1 text-muted">Tell it your goal and it will build a plan from the exercise library.</p>

      <Card className="mt-8 flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-muted">Goal (optional)</label>
          <Input placeholder="e.g. build muscle, lose fat, improve endurance" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Days per week</label>
          <Input
            type="number"
            min={1}
            max={7}
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">Focus areas (optional, comma-separated)</label>
          <Input placeholder="e.g. legs, core" value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate preview"}
          </Button>
          <Link href="/workout-plans">
            <Button variant="glass" type="button">
              Back to plans
            </Button>
          </Link>
        </div>
      </Card>

      {preview && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>{preview.title}</CardTitle>
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                {preview.difficulty}
              </span>
            </div>
            {preview.description && <CardDescription>{preview.description}</CardDescription>}

            <div className="flex flex-col gap-3">
              {preview.days.map((day) => (
                <div key={`${day.weekNumber}-${day.dayNumber}`} className="rounded-xl border border-foreground/10 p-3">
                  <div className="text-sm font-medium">
                    Day {day.dayNumber} {day.title ? `— ${day.title}` : ""} {day.isRestDay && "(Rest day)"}
                  </div>
                  {!day.isRestDay && (
                    <ul className="mt-1 list-inside list-disc text-xs text-muted">
                      {day.exercises.map((ex, idx) => (
                        <li key={idx}>
                          {ex.exerciseName ?? "Exercise"} — {ex.targetSets ?? "?"} x {ex.targetReps ?? "?"}{" "}
                          {ex.notes ? `— ${ex.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
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

export default function GenerateWorkoutPlanPage() {
  return (
    <RequireAuth>
      <GenerateContent />
    </RequireAuth>
  );
}
