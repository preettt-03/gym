"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, Flame, Sparkles } from "lucide-react";
import { listMyWorkoutPlans, WorkoutPlanSummary } from "@/lib/workout-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";
import { SkeletonList } from "@/components/ui/skeleton";

function PlanCard({ plan }: { plan: WorkoutPlanSummary }) {
  return (
    <Link href={`/workout-plans/${plan.id}`}>
      <Card className="flex h-full flex-col gap-2 transition hover:brightness-105">
        <div className="flex items-center justify-between">
          <CardTitle>{plan.title}</CardTitle>
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
            {plan.difficulty}
          </span>
        </div>
        {plan.description && <CardDescription>{plan.description}</CardDescription>}
        <div className="mt-2 flex gap-4 text-xs text-muted">
          {plan.estimatedMinutes && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {plan.estimatedMinutes} min
            </span>
          )}
          {plan.estimatedCalories && (
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" /> {plan.estimatedCalories} kcal
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function WorkoutPlansContent() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["workout-plans"], queryFn: listMyWorkoutPlans });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
            Workout Plans
          </motion.h1>
          <p className="mt-1 text-muted">Plans assigned to you and plans you&apos;ve built yourself.</p>
        </div>
        <Link href="/workout-plans/generate">
          <Button size="sm">
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Button>
        </Link>
      </div>

      {isLoading && <SkeletonList rows={3} className="mt-8" />}
      {isError && <p className="mt-8 text-danger">Could not load workout plans.</p>}

      {data && (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-muted uppercase tracking-wide">Assigned to you</h2>
            {data.assignedPlans.length === 0 ? (
              <Card>
                <CardDescription>No plans assigned yet. Your trainer or admin can assign one.</CardDescription>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.assignedPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium text-muted uppercase tracking-wide">Your custom plans</h2>
            {data.ownedPlans.length === 0 ? (
              <Card>
                <CardDescription>You haven&apos;t built a custom plan yet.</CardDescription>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.ownedPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function WorkoutPlansPage() {
  return (
    <RequireAuth>
      <WorkoutPlansContent />
    </RequireAuth>
  );
}
