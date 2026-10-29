import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2, UserPlus } from "lucide-react";
import {
  assignDietPlan,
  createDietPlan,
  deleteDietPlan,
  listAdminDietPlans,
  listFoodsForAdmin,
  listUsers,
} from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ItemRow {
  foodId: string;
  quantityGrams: string;
}

interface FormValues {
  title: string;
  description: string;
  estimatedCalories: string;
  mealType: string;
  items: ItemRow[];
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
    mutationFn: (userId: string) => assignDietPlan(planId, [userId]),
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

export function DietPlansPage() {
  const queryClient = useQueryClient();
  const { data: plans } = useQuery({ queryKey: ["admin-diet-plans"], queryFn: listAdminDietPlans });
  const { data: foods } = useQuery({ queryKey: ["admin-foods-all"], queryFn: () => listFoodsForAdmin() });

  const { register, control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { mealType: "BREAKFAST", items: [{ foodId: "", quantityGrams: "100" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const createMutation = useMutation({
    mutationFn: createDietPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-diet-plans"] });
      reset({
        title: "",
        description: "",
        estimatedCalories: "",
        mealType: "BREAKFAST",
        items: [{ foodId: "", quantityGrams: "100" }],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDietPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-diet-plans"] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Diet Plans</h1>
      <p className="mt-1 text-muted">{plans?.length ?? 0} plans. New plans start with a single meal you can assign.</p>

      <Card className="mt-6">
        <CardTitle>New plan</CardTitle>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={handleSubmit((values) =>
            createMutation.mutate({
              title: values.title,
              description: values.description || undefined,
              estimatedCalories: values.estimatedCalories ? Number(values.estimatedCalories) : undefined,
              meals: [
                {
                  mealType: values.mealType,
                  items: values.items
                    .filter((i) => i.foodId)
                    .map((i) => ({ foodId: i.foodId, quantityGrams: Number(i.quantityGrams) })),
                },
              ],
            })
          )}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input placeholder="Title" {...register("title", { required: true })} />
            <FormSelect control={control} name="mealType" aria-label="Meal type" options={[{ value: "BREAKFAST", label: "Breakfast" }, { value: "LUNCH", label: "Lunch" }, { value: "DINNER", label: "Dinner" }, { value: "SNACKS", label: "Snacks" }, { value: "PRE_WORKOUT", label: "Pre-workout" }, { value: "POST_WORKOUT", label: "Post-workout" }]} />
            <Input placeholder="Estimated calories/day" type="number" {...register("estimatedCalories")} />
            <Input placeholder="Description (optional)" {...register("description")} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Food items</div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <FormSelect
                  control={control}
                  name={`items.${index}.foodId`}
                  className="flex-1"
                  placeholder="Select food..."
                  aria-label={`Food for item ${index + 1}`}
                  options={(foods ?? []).map((f) => ({ value: f.id, label: f.name }))}
                />
                <Input
                  className="w-24"
                  placeholder="Grams"
                  type="number"
                  {...register(`items.${index}.quantityGrams`)}
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
              onClick={() => append({ foodId: "", quantityGrams: "100" })}
            >
              <Plus className="h-4 w-4" /> Add item
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
            <AssignControl planId={plan.id} />
          </Card>
        ))}
      </div>
    </div>
  );
}
