import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import {
  createMembershipPlan,
  deleteMembershipPlan,
  listAdminMembershipPlans,
  type CreateMembershipPlanInput,
} from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FormValues {
  name: string;
  description: string;
  durationDays: string;
  price: string;
  discountPercent: string;
  benefits: string;
}

export function MembershipPlansPage() {
  const queryClient = useQueryClient();
  const { data: plans } = useQuery({ queryKey: ["admin-membership-plans"], queryFn: listAdminMembershipPlans });

  const { register, handleSubmit, reset } = useForm<FormValues>();

  const createMutation = useMutation({
    mutationFn: (input: CreateMembershipPlanInput) => createMembershipPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-membership-plans"] });
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMembershipPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-membership-plans"] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Membership Plans</h1>
      <p className="mt-1 text-muted">{plans?.length ?? 0} plans configured.</p>

      <Card className="mt-6">
        <CardTitle>New plan</CardTitle>
        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={handleSubmit((values) =>
            createMutation.mutate({
              name: values.name,
              description: values.description || undefined,
              durationDays: Number(values.durationDays),
              price: Number(values.price),
              discountPercent: values.discountPercent ? Number(values.discountPercent) : undefined,
              benefits: values.benefits
                ? values.benefits.split(",").map((b) => b.trim()).filter(Boolean)
                : undefined,
            })
          )}
        >
          <Input placeholder="Name" {...register("name", { required: true })} />
          <Input placeholder="Duration (days)" type="number" {...register("durationDays", { required: true })} />
          <Input placeholder="Price (₹)" type="number" {...register("price", { required: true })} />
          <Input placeholder="Discount % (optional)" type="number" {...register("discountPercent")} />
          <Input placeholder="Description (optional)" className="sm:col-span-2" {...register("description")} />
          <Input
            placeholder="Benefits, comma separated (optional)"
            className="sm:col-span-2"
            {...register("benefits")}
          />
          <Button type="submit" className="sm:col-span-2" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" /> {createMutation.isPending ? "Creating..." : "Create plan"}
          </Button>
        </form>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{plan.name}</div>
              <button
                className="text-muted hover:text-danger"
                onClick={() => deleteMutation.mutate(plan.id)}
                aria-label="Delete plan"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-muted">
              {plan.durationDays} days · ₹{plan.price}
              {plan.discountPercent ? ` (${plan.discountPercent}% off)` : ""}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
