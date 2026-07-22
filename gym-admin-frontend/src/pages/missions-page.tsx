import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import {
  createBadge,
  createMission,
  deleteBadge,
  deleteMission,
  listAdminMissions,
  listBadges,
  type MissionConditionType,
} from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BadgeFormValues {
  name: string;
  description: string;
  streakThresholdDays: string;
}

interface MissionFormValues {
  title: string;
  description: string;
  conditionType: MissionConditionType;
  targetValue: string;
  rewardCoins: string;
  rewardXp: string;
  startDate: string;
  endDate: string;
}

function BadgesSection() {
  const queryClient = useQueryClient();
  const { data: badges } = useQuery({ queryKey: ["admin-badges"], queryFn: listBadges });
  const { register, handleSubmit, reset } = useForm<BadgeFormValues>();

  const createMutation = useMutation({
    mutationFn: createBadge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBadge,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-badges"] }),
  });

  return (
    <Card>
      <CardTitle>Badges</CardTitle>
      <form
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
        onSubmit={handleSubmit((values) =>
          createMutation.mutate({
            name: values.name,
            description: values.description || undefined,
            streakThresholdDays: values.streakThresholdDays ? Number(values.streakThresholdDays) : undefined,
          })
        )}
      >
        <Input placeholder="Name" {...register("name", { required: true })} />
        <Input placeholder="Streak days to auto-award (optional)" type="number" {...register("streakThresholdDays")} />
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {badges?.map((b) => (
          <span key={b.id} className="flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-xs text-accent">
            {b.name}
            {b.streakThresholdDays && ` (${b.streakThresholdDays}d streak)`}
            <button onClick={() => deleteMutation.mutate(b.id)} aria-label="Delete badge">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </Card>
  );
}

function MissionsSection() {
  const queryClient = useQueryClient();
  const { data: missions } = useQuery({ queryKey: ["admin-missions"], queryFn: listAdminMissions });
  const { register, handleSubmit, reset } = useForm<MissionFormValues>({
    defaultValues: { conditionType: "CUSTOM" },
  });

  const createMutation = useMutation({
    mutationFn: createMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMission,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-missions"] }),
  });

  return (
    <Card className="mt-6">
      <CardTitle>Missions</CardTitle>
      <form
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={handleSubmit((values) =>
          createMutation.mutate({
            title: values.title,
            description: values.description || undefined,
            conditionType: values.conditionType,
            targetValue: Number(values.targetValue),
            rewardCoins: Number(values.rewardCoins || 0),
            rewardXp: Number(values.rewardXp || 0),
            startDate: new Date(values.startDate).toISOString(),
            endDate: new Date(values.endDate).toISOString(),
          })
        )}
      >
        <Input placeholder="Title" {...register("title", { required: true })} />
        <select className="glass-input h-11 px-4 text-sm" {...register("conditionType")}>
          <option value="COMPLETE_WORKOUT">Complete workout</option>
          <option value="DRINK_WATER">Drink water</option>
          <option value="BURN_CALORIES">Burn calories</option>
          <option value="HIT_PROTEIN_GOAL">Hit protein goal</option>
          <option value="WALK_STEPS">Walk steps</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <Input placeholder="Target value" type="number" {...register("targetValue", { required: true })} />
        <Input placeholder="Reward coins" type="number" {...register("rewardCoins")} />
        <Input placeholder="Reward XP" type="number" {...register("rewardXp")} />
        <Input placeholder="Description (optional)" {...register("description")} />
        <label className="flex flex-col gap-1 text-xs text-muted">
          Start date
          <Input type="datetime-local" {...register("startDate", { required: true })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          End date
          <Input type="datetime-local" {...register("endDate", { required: true })} />
        </label>
        <Button type="submit" className="sm:col-span-2" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4" /> {createMutation.isPending ? "Creating..." : "Create mission"}
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {missions?.map((m) => (
          <div key={m.id} className="glass-input flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm font-medium">{m.title}</div>
              <div className="text-xs text-muted">
                {m.conditionType} · target {m.targetValue} · +{m.rewardCoins} coins, +{m.rewardXp} XP
              </div>
            </div>
            <button
              className="text-muted hover:text-danger"
              onClick={() => deleteMutation.mutate(m.id)}
              aria-label="Delete mission"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function MissionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Missions &amp; Badges</h1>
      <p className="mt-1 text-muted">Configure engagement rewards.</p>

      <div className="mt-6">
        <BadgesSection />
        <MissionsSection />
      </div>
    </div>
  );
}
