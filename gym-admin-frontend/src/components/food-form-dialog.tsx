import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { createFood, updateFood, type FoodInput, type ManagedFood } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { apiErrorMessage, useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Mirrors the backend rules: everything is per 100 g.
const amount = (label: string, max: number, unit: string, required: boolean) =>
  z
    .string()
    .trim()
    .refine((v) => !required || v !== "", `${label} is required`)
    .refine((v) => v === "" || Number.isFinite(Number(v)), "Enter a number")
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || v >= 0, "Cannot be negative")
    .refine((v) => v === undefined || v <= max, `Cannot exceed ${max.toLocaleString("en-IN")} ${unit}`);

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
    caloriesPer100g: amount("Calories", 900, "kcal", true),
    proteinPer100g: amount("Protein", 100, "g", true),
    carbsPer100g: amount("Carbs", 100, "g", true),
    fatPer100g: amount("Fat", 100, "g", true),
    fiberPer100g: amount("Fiber", 100, "g", false),
    sugarPer100g: amount("Sugar", 100, "g", false),
    sodiumMgPer100g: amount("Sodium", 50_000, "mg", false),
  })
  .refine((v) => (v.proteinPer100g ?? 0) + (v.carbsPer100g ?? 0) + (v.fatPer100g ?? 0) <= 100, {
    path: ["fatPer100g"],
    message: "Protein, carbs and fat together cannot exceed 100 g",
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const FIELDS: { name: keyof FormInput; label: string; unit: string; required?: boolean }[] = [
  { name: "caloriesPer100g", label: "Calories", unit: "kcal", required: true },
  { name: "proteinPer100g", label: "Protein", unit: "g", required: true },
  { name: "carbsPer100g", label: "Carbs", unit: "g", required: true },
  { name: "fatPer100g", label: "Fat", unit: "g", required: true },
  { name: "fiberPer100g", label: "Fiber", unit: "g" },
  { name: "sugarPer100g", label: "Sugar", unit: "g" },
  { name: "sodiumMgPer100g", label: "Sodium", unit: "mg" },
];

const toText = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function defaults(food?: ManagedFood | null): FormInput {
  return {
    name: food?.name ?? "",
    caloriesPer100g: toText(food?.caloriesPer100g),
    proteinPer100g: toText(food?.proteinPer100g),
    carbsPer100g: toText(food?.carbsPer100g),
    fatPer100g: toText(food?.fatPer100g),
    fiberPer100g: toText(food?.fiberPer100g),
    sugarPer100g: toText(food?.sugarPer100g),
    sodiumMgPer100g: toText(food?.sodiumMgPer100g),
  };
}

export function FoodFormDialog({ open, food, onClose }: { open: boolean; food: ManagedFood | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const editing = Boolean(food);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: defaults(food) });

  useEffect(() => {
    if (open) {
      reset(defaults(food));
      setServerError(null);
    }
  }, [open, food, reset]);

  const [p, c, f] = useWatch({ control, name: ["proteinPer100g", "carbsPer100g", "fatPer100g"] }).map((v) => Number(v) || 0);
  const macroTotal = p + c + f;

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      // Empty optional fields clear the stored value when editing.
      const input: FoodInput = {
        ...values,
        caloriesPer100g: values.caloriesPer100g!,
        proteinPer100g: values.proteinPer100g!,
        carbsPer100g: values.carbsPer100g!,
        fatPer100g: values.fatPer100g!,
        fiberPer100g: values.fiberPer100g ?? (editing ? null : undefined),
        sugarPer100g: values.sugarPer100g ?? (editing ? null : undefined),
        sodiumMgPer100g: values.sodiumMgPer100g ?? (editing ? null : undefined),
      };
      return food ? updateFood(food.id, input) : createFood(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["managed-foods"] });
      queryClient.invalidateQueries({ queryKey: ["admin-foods-all"] });
      toast.show(editing ? `Updated ${saved.name}` : `Added ${saved.name}`);
      onClose();
    },
    onError: (err) => setServerError(apiErrorMessage(err, "Could not save food")),
  });

  return (
    <Dialog
      open={open}
      onClose={mutation.isPending ? () => {} : onClose}
      title={editing ? "Edit food" : "Add food"}
      description="All values are per 100 g of the food."
      footer={
        <>
          <Button variant="glass" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="food-form" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add food"}
          </Button>
        </>
      }
    >
      <form
        id="food-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        <div>
          <label htmlFor="food-name" className="mb-1.5 block text-sm font-medium">
            Name
          </label>
          <Input
            id="food-name"
            data-autofocus
            placeholder="e.g. Rolled oats"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby="food-name-error"
            {...register("name")}
          />
          <FieldError id="food-name-error" message={errors.name?.message} />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
          {FIELDS.map((field) => (
            <div key={field.name}>
              <label htmlFor={`food-${field.name}`} className="mb-1.5 block text-sm font-medium">
                {field.label}
                {!field.required && <span className="ml-1 text-xs font-normal text-muted">(optional)</span>}
              </label>
              <div className="relative">
                <Input
                  id={`food-${field.name}`}
                  inputMode="decimal"
                  className="pr-12"
                  aria-invalid={errors[field.name] ? true : undefined}
                  aria-describedby={`food-${field.name}-error`}
                  {...register(field.name)}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{field.unit}</span>
              </div>
              <FieldError id={`food-${field.name}-error`} message={errors[field.name]?.message} />
            </div>
          ))}
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted">
            <span>Protein + carbs + fat</span>
            <span className={cn("tabular-nums", macroTotal > 100 && "font-semibold text-danger")}>{macroTotal.toFixed(1)} / 100 g</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-2">
            <div
              className={cn("h-1.5 rounded-full transition-all", macroTotal > 100 ? "bg-danger" : "bg-gold")}
              style={{ width: `${Math.min(100, macroTotal)}%` }}
            />
          </div>
        </div>

        <FormAlert message={serverError} />
      </form>
    </Dialog>
  );
}
