"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Moon } from "lucide-react";
import { completeWorkoutDay, getWorkoutPlan, WorkoutPlanDay } from "@/lib/workout-api";
import { Card, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";
import { SkeletonList } from "@/components/ui/skeleton";

function DayCard({ planId, day }: { planId: string; day: WorkoutPlanDay }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => completeWorkoutDay(day.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-plan", planId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (day.isRestDay) {
    return (
      <Card className="flex items-center gap-3 opacity-70">
        <Moon className="h-4 w-4 text-muted" />
        <div>
          <div className="font-medium">{day.title ?? `Day ${day.dayNumber}`}</div>
          <div className="text-xs text-muted">Rest day</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{day.title ?? `Day ${day.dayNumber}`}</div>
          <div className="text-xs text-muted">Week {day.weekNumber}</div>
        </div>
        <Button
          variant={mutation.isSuccess ? "glass" : "default"}
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Completed
            </>
          ) : mutation.isPending ? (
            "Saving..."
          ) : (
            "Mark complete"
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {day.exercises.map((entry) => (
          <div key={entry.id} className="glass-input flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm font-medium">
                {entry.exercise.name}
                {entry.isSwapped && <span className="ml-2 text-xs text-accent">(swapped)</span>}
              </div>
              <div className="text-xs text-muted">{entry.exercise.targetMuscle}</div>
            </div>
            <div className="text-right text-xs text-muted">
              {entry.targetSets && entry.targetReps && (
                <div>
                  {entry.targetSets} × {entry.targetReps}
                </div>
              )}
              {entry.targetWeightKg && <div>{entry.targetWeightKg} kg</div>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WorkoutPlanDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isLoading, isError } = useQuery({
    queryKey: ["workout-plan", id],
    queryFn: () => getWorkoutPlan(id),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {isLoading && <SkeletonList rows={3} />}
      {isError && <p className="text-danger">Could not load this plan.</p>}

      {plan && (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-semibold">{plan.title}</h1>
            {plan.description && <CardDescription className="mt-1">{plan.description}</CardDescription>}
            <div className="mt-3 flex gap-3 text-sm text-muted">
              <span>{plan.difficulty}</span>
              {plan.estimatedMinutes && <span>{plan.estimatedMinutes} min</span>}
              {plan.estimatedCalories && <span>{plan.estimatedCalories} kcal</span>}
            </div>
          </motion.div>

          <div className="mt-8 flex flex-col gap-4">
            {plan.days
              .slice()
              .sort((a, b) => a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber)
              .map((day) => (
                <DayCard key={day.id} planId={plan.id} day={day} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkoutPlanDetailPage() {
  return (
    <RequireAuth>
      <WorkoutPlanDetailContent />
    </RequireAuth>
  );
}
