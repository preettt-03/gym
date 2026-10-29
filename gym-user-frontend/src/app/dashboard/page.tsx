"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarCheck, Flame, Droplets, Sparkles, Target, Trophy, UtensilsCrossed } from "lucide-react";
import { getDashboard } from "@/lib/api";
import { getMotivationMessage, getNutritionSuggestion } from "@/lib/ai-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { RequireAuth } from "@/components/require-auth";
import { useAuthStore } from "@/stores/auth-store";
import { SkeletonList } from "@/components/ui/skeleton";

function AiInsightsCard() {
  const motivationQuery = useQuery({
    queryKey: ["ai-motivation"],
    queryFn: getMotivationMessage,
    retry: false,
  });
  const nutritionQuery = useQuery({
    queryKey: ["ai-nutrition-suggestion"],
    queryFn: getNutritionSuggestion,
    retry: false,
  });

  if (motivationQuery.isError && nutritionQuery.isError) return null;

  return (
    <Card className="sm:col-span-2 lg:col-span-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <CardTitle>AI Coach</CardTitle>
      </div>
      {motivationQuery.data && (
        <CardDescription className="mt-2">{motivationQuery.data.message}</CardDescription>
      )}
      {nutritionQuery.data?.suggestion && (
        <CardDescription className="mt-3 border-t border-foreground/10 pt-3">
          {nutritionQuery.data.suggestion}
        </CardDescription>
      )}
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}

function DashboardContent() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
        Welcome back{user?.name ? `, ${user.name}` : ""}
      </motion.h1>
      <p className="mt-1 text-muted">Here&apos;s where you stand today.</p>

      {isLoading && <SkeletonList rows={3} className="mt-8" />}
      {isError && <p className="mt-8 text-danger">Could not load dashboard. Is the backend running?</p>}

      {data && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            icon={<Target className="h-4 w-4" />}
            label="BMI"
            value={data.metrics.bmi?.toString() ?? "—"}
            sub={data.metrics.bmiCategory ?? "Complete your profile"}
          />
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Calorie needs"
            value={data.metrics.calorieNeeds ? `${data.metrics.calorieNeeds} kcal` : "—"}
          />
          <StatCard
            icon={<Droplets className="h-4 w-4" />}
            label="Water target"
            value={data.metrics.waterIntakeLiters ? `${data.metrics.waterIntakeLiters} L` : "—"}
          />
          <StatCard
            icon={<Trophy className="h-4 w-4" />}
            label="Current streak"
            value={`${data.streak.currentStreak} day${data.streak.currentStreak === 1 ? "" : "s"}`}
            sub={`Longest: ${data.streak.longestStreak}`}
          />

          <Card className="sm:col-span-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-accent" /> Today&apos;s workout
            </CardTitle>
            {data.today.workout ? (
              <CardDescription className="mt-2">
                {data.today.workout.day.isRestDay
                  ? `Rest day — ${data.today.workout.planTitle}`
                  : `${data.today.workout.day.title || "Training day"} — ${data.today.workout.planTitle}`}
                {!data.today.workout.day.isRestDay && data.today.workout.day.exercises.length > 0 && (
                  <span className="mt-1 block text-xs">
                    {data.today.workout.day.exercises.map((e) => e.exercise.name).join(", ")}
                  </span>
                )}
              </CardDescription>
            ) : (
              <CardDescription className="mt-2">
                {data.activePlan ? data.activePlan.title : "No workout plan yet — browse plans to get started."}
              </CardDescription>
            )}
          </Card>

          <Card className="sm:col-span-2">
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-accent-2" /> Today&apos;s diet
            </CardTitle>
            <CardDescription className="mt-2">
              {data.today.diet
                ? `${data.today.diet.title} — ${data.today.diet.meals.map((m) => m.mealType).join(", ")}`
                : "No diet plan yet — browse plans to get started."}
            </CardDescription>
          </Card>

          <Card className="sm:col-span-1">
            <CardTitle>Gym status</CardTitle>
            <CardDescription className="mt-2">
              {data.gymAttendanceStatus.checkedIn ? "Checked in" : "Not checked in"}
            </CardDescription>
          </Card>

          <Card className="sm:col-span-1">
            <CardTitle>Missions</CardTitle>
            <CardDescription className="mt-2">
              {data.dailyMissionProgress.completed}/{data.dailyMissionProgress.total} completed
            </CardDescription>
          </Card>

          <AiInsightsCard />
        </motion.div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
