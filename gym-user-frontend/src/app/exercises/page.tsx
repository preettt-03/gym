"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Dumbbell, Search, Sparkles } from "lucide-react";
import { listExerciseCategories, listExercises } from "@/lib/api";
import { getFormTip } from "@/lib/ai-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const difficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

function FormTipButton({ exerciseId }: { exerciseId: string }) {
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const [tip, setTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (tip) {
      setTip(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getFormTip(exerciseId);
      setTip(result.tip);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Could not fetch a form tip right now.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthed) return null;

  return (
    <div className="mt-1">
      <Button variant="glass" size="sm" onClick={handleClick} disabled={loading}>
        <Sparkles className="h-3.5 w-3.5" /> {loading ? "Loading..." : tip ? "Hide AI tip" : "AI form tip"}
      </Button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {tip && <p className="mt-2 whitespace-pre-line text-xs text-muted">{tip}</p>}
    </div>
  );
}

export default function ExercisesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [difficulty, setDifficulty] = useState<string | undefined>();

  const { data: categories } = useQuery({ queryKey: ["exercise-categories"], queryFn: listExerciseCategories });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["exercises", search, category, difficulty],
    queryFn: () => listExercises({ search: search || undefined, category, difficulty }),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
        Exercise Library
      </motion.h1>
      <p className="mt-1 text-muted">Browse freely — no account needed.</p>

      <div className="mt-6 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search exercises..."
            className="pl-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={category === undefined ? "default" : "glass"}
            size="sm"
            onClick={() => setCategory(undefined)}
          >
            All
          </Button>
          {categories?.map((c) => (
            <Button
              key={c.id}
              variant={category === c.slug ? "default" : "glass"}
              size="sm"
              onClick={() => setCategory(c.slug)}
            >
              {c.name}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={difficulty === undefined ? "default" : "glass"}
            size="sm"
            onClick={() => setDifficulty(undefined)}
          >
            Any difficulty
          </Button>
          {difficulties.map((d) => (
            <Button
              key={d}
              variant={difficulty === d ? "default" : "glass"}
              size="sm"
              onClick={() => setDifficulty(d)}
            >
              {d.charAt(0) + d.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <p className="mt-8 text-muted">Loading exercises...</p>}
      {isError && <p className="mt-8 text-danger">Could not load exercises. Is the backend running?</p>}
      {data && data.items.length === 0 && <p className="mt-8 text-muted">No exercises match your filters.</p>}

      <motion.div
        layout
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {data?.items.map((exercise, i) => (
          <motion.div
            key={exercise.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
          >
            <Card className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-full accent-gradient text-white">
                  <Dumbbell className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    exercise.difficulty === "BEGINNER" && "bg-accent-2/15 text-accent-2",
                    exercise.difficulty === "INTERMEDIATE" && "bg-accent/15 text-accent",
                    exercise.difficulty === "ADVANCED" && "bg-danger/15 text-danger"
                  )}
                >
                  {exercise.difficulty}
                </span>
              </div>
              <CardTitle>{exercise.name}</CardTitle>
              <CardDescription>{exercise.targetMuscle}</CardDescription>
              {exercise.equipment.length > 0 && (
                <p className="text-xs text-muted">{exercise.equipment.join(", ")}</p>
              )}
              <FormTipButton exerciseId={exercise.id} />
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
