import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2, UserPlus } from "lucide-react";
import {
  assignWorkoutPlan,
  createWorkoutPlan,
  deleteWorkoutPlan,
  listAdminWorkoutPlans,
  listExercises,
  listUsers,
  type Difficulty,
} from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ExerciseRow {
  exerciseId: string;
  targetSets: string;
  targetReps: string;
}

interface FormValues {
  title: string;
  description: string;
  difficulty: Difficulty;
  estimatedCalories: string;
  estimatedMinutes: string;
  exercises: ExerciseRow[];
}

function AssignControl({ planId }: { planId: string }) {
  const [search, setSearch] = useState("");
  const [done, setDone] = useState(false);

  const { data: candidates } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => listUsers({ search: search || undefined }),
    enabled: search.trim().length >= 2,
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string) => assignWorkoutPlan(planId, [userId]),
    onSuccess: () => {
      setSearch("");
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    },
  });

  return (
    <div className="relative">
      <Input placeholder="Assign to user..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {done && <p className="mt-1 text-xs text-accent-2">Assigned.</p>}
      {search.trim().length >= 2 && candidates && (
        <div className="glass-card absolute z-10 mt-1 w-full p-1">
          {candidates.items.map((u) => (
            <button
              key={u.id}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5"
              onClick={() => assignMutation.mutate(u.id)}
            >
              <span>{u.name ?? u.email}</span>
              <UserPlus className="h-3.5 w-3.5 text-accent" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkoutPlansPage() {
  const queryClient = useQueryClient();
  const { data: plans } = useQuery({ queryKey: ["admin-workout-plans"], queryFn: listAdminWorkoutPlans });
  const { data: exercises } = useQuery({ queryKey: ["admin-exercises-all"], queryFn: () => listExercises({ limit: 100 }) });

  const { register, control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { difficulty: "BEGINNER", exercises: [{ exerciseId: "", targetSets: "3", targetReps: "10" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "exercises" });

  const createMutation = useMutation({
    mutationFn: createWorkoutPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-workout-plans"] });
      reset({
        title: "",
        description: "",
        difficulty: "BEGINNER",
        estimatedCalories: "",
        estimatedMinutes: "",
        exercises: [{ exerciseId: "", targetSets: "3", targetReps: "10" }],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkoutPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-workout-plans"] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Workout Plans</h1>
      <p className="mt-1 text-muted">{plans?.length ?? 0} plans. New plans are single-day templates you can assign.</p>

      <Card className="mt-6">
        <CardTitle>New plan</CardTitle>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={handleSubmit((values) =>
            createMutation.mutate({
              title: values.title,
              description: values.description || undefined,
              difficulty: values.difficulty,
              estimatedCalories: values.estimatedCalories ? Number(values.estimatedCalories) : undefined,
              estimatedMinutes: values.estimatedMinutes ? Number(values.estimatedMinutes) : undefined,
              days: [
                {
                  weekNumber: 1,
                  dayNumber: 1,
                  isRestDay: false,
                  exercises: values.exercises
                    .filter((e) => e.exerciseId)
                    .map((e) => ({
                      exerciseId: e.exerciseId,
                      targetSets: e.targetSets ? Number(e.targetSets) : undefined,
                      targetReps: e.targetReps ? Number(e.targetReps) : undefined,
                    })),
                },
              ],
            })
          )}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input placeholder="Title" {...register("title", { required: true })} />
            <FormSelect control={control} name="difficulty" aria-label="Difficulty" options={[{ value: "BEGINNER", label: "Beginner" }, { value: "INTERMEDIATE", label: "Intermediate" }, { value: "ADVANCED", label: "Advanced" }]} />
            <Input placeholder="Estimated calories" type="number" {...register("estimatedCalories")} />
            <Input placeholder="Estimated minutes" type="number" {...register("estimatedMinutes")} />
            <Input placeholder="Description (optional)" className="sm:col-span-2" {...register("description")} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Exercises</div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <FormSelect
                  control={control}
                  name={`exercises.${index}.exerciseId`}
                  className="flex-1"
                  placeholder="Select exercise..."
                  aria-label={`Exercise ${index + 1}`}
                  options={(exercises?.items ?? []).map((ex) => ({ value: ex.id, label: ex.name }))}
                />
                <Input
                  className="w-20"
                  placeholder="Sets"
                  type="number"
                  {...register(`exercises.${index}.targetSets`)}
                />
                <Input
                  className="w-20"
                  placeholder="Reps"
                  type="number"
                  {...register(`exercises.${index}.targetReps`)}
                />
                <button type="button" className="text-muted hover:text-danger" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="glass"
              size="sm"
              className="self-start"
              onClick={() => append({ exerciseId: "", targetSets: "3", targetReps: "10" })}
            >
              <Plus className="h-4 w-4" /> Add exercise
            </Button>
          </div>

          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create plan"}
          </Button>
        </form>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans?.map((plan) => (
          <Card key={plan.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{plan.title}</div>
              <button
                className="text-muted hover:text-danger"
                onClick={() => deleteMutation.mutate(plan.id)}
                aria-label="Delete plan"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-muted">{plan.difficulty}</div>
            <AssignControl planId={plan.id} />
          </Card>
        ))}
      </div>
    </div>
  );
}
