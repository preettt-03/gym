"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ArrowLeft, Dumbbell, Send, UtensilsCrossed } from "lucide-react";
import {
  assignDietPlanToTrainee,
  assignWorkoutPlanToTrainee,
  getTraineeOverview,
  getTraineeProfile,
  listAssignableDietPlans,
  listAssignableWorkoutPlans,
  listTraineeAttendance,
  listTraineeWeightLogs,
  listTraineeWorkoutLogs,
  sendNoteToTrainee,
} from "@/lib/trainer-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequireAuth } from "@/components/require-auth";

function TraineeDetailContent() {
  const { traineeId } = useParams<{ traineeId: string }>();
  const queryClient = useQueryClient();
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [selectedWorkoutPlan, setSelectedWorkoutPlan] = useState("");
  const [selectedDietPlan, setSelectedDietPlan] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["trainer-trainee-profile", traineeId],
    queryFn: () => getTraineeProfile(traineeId),
  });
  const { data: overview } = useQuery({
    queryKey: ["trainer-trainee-overview", traineeId],
    queryFn: () => getTraineeOverview(traineeId),
  });
  const { data: workoutLogs } = useQuery({
    queryKey: ["trainer-trainee-workout-logs", traineeId],
    queryFn: () => listTraineeWorkoutLogs(traineeId),
  });
  const { data: weightLogs } = useQuery({
    queryKey: ["trainer-trainee-weight-logs", traineeId],
    queryFn: () => listTraineeWeightLogs(traineeId),
  });
  const { data: attendance } = useQuery({
    queryKey: ["trainer-trainee-attendance", traineeId],
    queryFn: () => listTraineeAttendance(traineeId),
  });
  const { data: workoutPlans } = useQuery({
    queryKey: ["trainer-assignable-workout-plans"],
    queryFn: listAssignableWorkoutPlans,
  });
  const { data: dietPlans } = useQuery({
    queryKey: ["trainer-assignable-diet-plans"],
    queryFn: listAssignableDietPlans,
  });

  const assignWorkoutMutation = useMutation({
    mutationFn: () => assignWorkoutPlanToTrainee(traineeId, selectedWorkoutPlan),
    onSuccess: () => {
      setFeedback("Workout plan assigned.");
      queryClient.invalidateQueries({ queryKey: ["trainer-trainee-overview", traineeId] });
    },
  });

  const assignDietMutation = useMutation({
    mutationFn: () => assignDietPlanToTrainee(traineeId, selectedDietPlan),
    onSuccess: () => {
      setFeedback("Diet plan assigned.");
      queryClient.invalidateQueries({ queryKey: ["trainer-trainee-overview", traineeId] });
    },
  });

  const sendNoteMutation = useMutation({
    mutationFn: () => sendNoteToTrainee(traineeId, noteTitle, noteBody || undefined),
    onSuccess: () => {
      setFeedback("Note sent.");
      setNoteTitle("");
      setNoteBody("");
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/trainer" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to trainees
      </Link>

      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-2xl font-semibold">
        {profile?.name || profile?.email || "Trainee"}
      </motion.h1>
      <p className="mt-1 text-muted">{profile?.email}</p>

      {overview && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardDescription>BMI</CardDescription>
            <div className="mt-1 text-xl font-semibold">{overview.metrics.bmi ?? "—"}</div>
          </Card>
          <Card>
            <CardDescription>Streak</CardDescription>
            <div className="mt-1 text-xl font-semibold">{overview.streak.currentStreak}d</div>
          </Card>
          <Card>
            <CardDescription>Active plan</CardDescription>
            <div className="mt-1 text-sm font-medium">{overview.activePlan?.title ?? "None"}</div>
          </Card>
          <Card>
            <CardDescription>Gym status</CardDescription>
            <div className="mt-1 text-sm font-medium">
              {overview.gymAttendanceStatus.checkedIn ? "Checked in" : "Not checked in"}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-accent" /> Assign workout plan
          </CardTitle>
          <select
            className="glass-input h-11 w-full px-4 text-sm outline-none"
            value={selectedWorkoutPlan}
            onChange={(e) => setSelectedWorkoutPlan(e.target.value)}
          >
            <option value="">Select a plan...</option>
            {workoutPlans?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <Button
            disabled={!selectedWorkoutPlan || assignWorkoutMutation.isPending}
            onClick={() => assignWorkoutMutation.mutate()}
          >
            Assign
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-accent-2" /> Assign diet plan
          </CardTitle>
          <select
            className="glass-input h-11 w-full px-4 text-sm outline-none"
            value={selectedDietPlan}
            onChange={(e) => setSelectedDietPlan(e.target.value)}
          >
            <option value="">Select a plan...</option>
            {dietPlans?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <Button
            disabled={!selectedDietPlan || assignDietMutation.isPending}
            onClick={() => assignDietMutation.mutate()}
          >
            Assign
          </Button>
        </Card>
      </div>

      <Card className="mt-6 flex flex-col gap-3">
        <CardTitle className="flex items-center gap-2">
          <Send className="h-4 w-4 text-accent" /> Send a note
        </CardTitle>
        <Input placeholder="Title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
        <Input placeholder="Message (optional)" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
        <Button
          disabled={!noteTitle || sendNoteMutation.isPending}
          onClick={() => sendNoteMutation.mutate()}
        >
          Send
        </Button>
      </Card>

      {feedback && <p className="mt-3 text-sm text-accent-2">{feedback}</p>}

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wide text-muted">Recent workouts</h2>
      <Card className="flex flex-col gap-2">
        {(!workoutLogs || workoutLogs.length === 0) && <CardDescription>No workout logs yet.</CardDescription>}
        {workoutLogs?.map((log) => (
          <div key={log.id} className="flex items-center justify-between text-sm">
            <span>{log.plan?.title ?? "Workout"}</span>
            <span className="text-xs text-muted">{format(new Date(log.date), "PP")}</span>
          </div>
        ))}
      </Card>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wide text-muted">Weight history</h2>
      <Card className="flex flex-col gap-2">
        {(!weightLogs || weightLogs.length === 0) && <CardDescription>No weight logs yet.</CardDescription>}
        {weightLogs?.map((log) => (
          <div key={log.id} className="flex items-center justify-between text-sm">
            <span>{log.weightKg} kg</span>
            <span className="text-xs text-muted">{format(new Date(log.loggedAt), "PP")}</span>
          </div>
        ))}
      </Card>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wide text-muted">Attendance</h2>
      <Card className="flex flex-col gap-2">
        {(!attendance || attendance.length === 0) && <CardDescription>No attendance records yet.</CardDescription>}
        {attendance?.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm">
            <span>{format(new Date(a.checkInAt), "PPp")}</span>
            <span className="text-xs text-muted">{a.durationMinutes ? `${a.durationMinutes} min` : "In progress"}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default function TrainerTraineeDetailPage() {
  return (
    <RequireAuth>
      <TraineeDetailContent />
    </RequireAuth>
  );
}
