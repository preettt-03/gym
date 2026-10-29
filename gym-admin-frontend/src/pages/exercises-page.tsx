import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { createExercise, deleteExercise, listExercises } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  targetMuscle: z.string().min(1, "Target muscle is required"),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  caloriesBurnedEstimate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ExercisesPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-exercises"], queryFn: () => listExercises({}) });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { difficulty: "BEGINNER" } });

  const createMutation = useMutation({
    mutationFn: createExercise,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exercises"] });
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExercise,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-exercises"] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Exercises</h1>
      <p className="mt-1 text-muted">{data?.pagination.total ?? 0} exercises in the library.</p>

      <Card className="mt-6">
        <CardTitle>Add exercise</CardTitle>
        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={handleSubmit((values: FormValues) =>
            createMutation.mutate({
              ...values,
              caloriesBurnedEstimate: values.caloriesBurnedEstimate
                ? Number(values.caloriesBurnedEstimate)
                : undefined,
            })
          )}
        >
          <div>
            <Input placeholder="Name" {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div>
            <Input placeholder="Target muscle" {...register("targetMuscle")} />
            {errors.targetMuscle && <p className="mt-1 text-xs text-danger">{errors.targetMuscle.message}</p>}
          </div>
          <FormSelect control={control} name="difficulty" aria-label="Difficulty" options={[{ value: "BEGINNER", label: "Beginner" }, { value: "INTERMEDIATE", label: "Intermediate" }, { value: "ADVANCED", label: "Advanced" }]} />
          <Input type="number" placeholder="Calories burned (optional)" {...register("caloriesBurnedEstimate")} />
          <Button type="submit" className="sm:col-span-2" disabled={isSubmitting || createMutation.isPending}>
            <Plus className="h-4 w-4" /> {createMutation.isPending ? "Adding..." : "Add exercise"}
          </Button>
        </form>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((ex) => (
          <Card key={ex.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{ex.name}</div>
              <button
                className="text-muted hover:text-danger"
                onClick={() => deleteMutation.mutate(ex.id)}
                aria-label="Delete exercise"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-muted">
              {ex.targetMuscle} · {ex.difficulty}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
