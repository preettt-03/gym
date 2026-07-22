"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Camera, Dumbbell, ImagePlus, Plus, Scale } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  createProgressPhoto,
  listProgressPhotos,
  listWeightLogs,
  listWorkoutHistory,
  logWeight,
  uploadProgressPhotoFile,
} from "@/lib/progress-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";

function WeightChart() {
  const queryClient = useQueryClient();
  const [weight, setWeight] = useState("");

  const { data: logs } = useQuery({ queryKey: ["weight-logs"], queryFn: listWeightLogs });

  const mutation = useMutation({
    mutationFn: logWeight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setWeight("");
    },
  });

  const chartData = (logs ?? [])
    .slice()
    .reverse()
    .map((l) => ({ date: format(new Date(l.loggedAt), "MMM d"), weight: l.weightKg }));

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Weight trend</CardTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(weight);
            if (value > 0) mutation.mutate(value);
          }}
        >
          <Input
            type="number"
            step="0.1"
            placeholder="kg"
            className="h-9 w-24 px-3 text-sm"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={mutation.isPending || !weight}>
            <Plus className="h-4 w-4" /> Log
          </Button>
        </form>
      </div>

      {chartData.length === 0 ? (
        <CardDescription className="mt-4">Log your weight to see a trend line here.</CardDescription>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--glass-border)" />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                stroke="var(--glass-border)"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 12,
                }}
              />
              <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function WorkoutHistory() {
  const { data } = useQuery({ queryKey: ["workout-history"], queryFn: listWorkoutHistory });

  return (
    <Card>
      <CardTitle>Workout history</CardTitle>
      {data?.items.length === 0 && <CardDescription className="mt-2">No workouts logged yet.</CardDescription>}
      <div className="mt-3 flex flex-col gap-2">
        {data?.items.map((log) => (
          <div key={log.id} className="glass-input flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-accent" />
              <div>
                <div className="text-sm font-medium">{log.plan?.title ?? "Workout"}</div>
                <div className="text-xs text-muted">{log.day?.title ?? ""}</div>
              </div>
            </div>
            <div className="text-xs text-muted">{format(new Date(log.date), "PP")}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProgressPhotos() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: photos } = useQuery({ queryKey: ["progress-photos"], queryFn: listProgressPhotos });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadProgressPhotoFile(file);
      return createProgressPhoto(url, notes || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress-photos"] });
      setNotes("");
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: () => setError("Could not upload photo. Please try again."),
  });

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-accent" /> Progress photos
        </CardTitle>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Note (optional, e.g. 'Week 4')"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="sm:flex-1"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
          }}
        />
        <Button
          type="button"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" /> {uploadMutation.isPending ? "Uploading..." : "Add photo"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {photos?.length === 0 && (
        <CardDescription className="mt-4">No progress photos yet — add one to start a timeline.</CardDescription>
      )}

      {photos && photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="glass-card overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.photoUrl} alt={photo.notes ?? ""} className="aspect-square w-full object-cover" />
              <div className="px-2.5 py-2 text-xs text-muted">
                <div>{format(new Date(photo.takenAt), "PP")}</div>
                {photo.notes && <div className="mt-0.5 truncate text-foreground/80">{photo.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProgressContent() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
        Progress
      </motion.h1>
      <p className="mt-1 flex items-center gap-1.5 text-muted">
        <Scale className="h-4 w-4" /> Track your weight and workout history over time.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <WeightChart />
        <ProgressPhotos />
        <WorkoutHistory />
      </div>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <RequireAuth>
      <ProgressContent />
    </RequireAuth>
  );
}
