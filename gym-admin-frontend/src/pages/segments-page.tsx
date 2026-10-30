import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Bell, Eye, Plus, Trash2, UtensilsCrossed, Dumbbell } from "lucide-react";
import {
  assignDietPlanToSegment,
  assignWorkoutPlanToSegment,
  createSegment,
  deleteSegment,
  listSegments,
  notifySegment,
  previewSegment,
  type Segment,
} from "@/lib/ops-api";
import { listAdminDietPlans, listAdminWorkoutPlans } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormSelect, Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface FormValues {
  name: string;
  description: string;
  fitnessGoal: string;
  experienceLevel: string;
  gender: string;
  ageMin: string;
  ageMax: string;
  membershipStatus: string;
  inactiveDays: string;
}

function SegmentCard({ segment }: { segment: Segment }) {
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);
  const [selectedWorkoutPlan, setSelectedWorkoutPlan] = useState("");
  const [selectedDietPlan, setSelectedDietPlan] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: preview } = useQuery({
    queryKey: ["segment-preview", segment.id],
    queryFn: () => previewSegment(segment.id),
    enabled: showPreview,
  });

  const { data: workoutPlans } = useQuery({ queryKey: ["admin-workout-plans"], queryFn: listAdminWorkoutPlans });
  const { data: dietPlans } = useQuery({ queryKey: ["admin-diet-plans"], queryFn: listAdminDietPlans });

  const deleteMutation = useMutation({
    mutationFn: deleteSegment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-segments"] }),
  });

  const assignWorkoutMutation = useMutation({
    mutationFn: () => assignWorkoutPlanToSegment(segment.id, selectedWorkoutPlan),
    onSuccess: (data) => setFeedback(`Assigned workout plan to ${data.assignedCount} users.`),
  });

  const assignDietMutation = useMutation({
    mutationFn: () => assignDietPlanToSegment(segment.id, selectedDietPlan),
    onSuccess: (data) => setFeedback(`Assigned diet plan to ${data.assignedCount} users.`),
  });

  const notifyMutation = useMutation({
    mutationFn: () => notifySegment(segment.id, notifyTitle),
    onSuccess: (data) => {
      setFeedback(`Notified ${data.notified} users.`);
      setNotifyTitle("");
    },
  });

  const ruleEntries = Object.entries(segment.rules).filter(([, v]) => v !== undefined && v !== "");

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{segment.name}</div>
          {segment.description && <div className="text-xs text-muted">{segment.description}</div>}
        </div>
        <button className="text-muted hover:text-danger" onClick={() => deleteMutation.mutate(segment.id)}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ruleEntries.map(([key, value]) => (
          <span key={key} className="rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">
            {key}: {String(value)}
          </span>
        ))}
        {ruleEntries.length === 0 && <span className="text-xs text-muted">All users</span>}
      </div>

      <Button variant="glass" size="sm" className="self-start" onClick={() => setShowPreview((s) => !s)}>
        <Eye className="h-3.5 w-3.5" /> {showPreview ? "Hide" : "Preview"} matching users
      </Button>

      {showPreview && preview && (
        <div className="glass-input px-4 py-3 text-sm">
          <div className="font-medium">{preview.count} matching users</div>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
            {preview.sample.map((u) => (
              <li key={u.id}>{u.name ?? u.email}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Select
            size="sm"
            className="flex-1"
            value={selectedWorkoutPlan}
            onChange={setSelectedWorkoutPlan}
            placeholder="Select workout plan..."
            aria-label="Workout plan to assign"
            options={(workoutPlans ?? []).map((p) => ({ value: p.id, label: p.title }))}
          />
          <Button
            size="sm"
            disabled={!selectedWorkoutPlan || assignWorkoutMutation.isPending}
            onClick={() => assignWorkoutMutation.mutate()}
          >
            <Dumbbell className="h-3.5 w-3.5" /> Assign
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select
            size="sm"
            className="flex-1"
            value={selectedDietPlan}
            onChange={setSelectedDietPlan}
            placeholder="Select diet plan..."
            aria-label="Diet plan to assign"
            options={(dietPlans ?? []).map((p) => ({ value: p.id, label: p.title }))}
          />
          <Button
            size="sm"
            disabled={!selectedDietPlan || assignDietMutation.isPending}
            onClick={() => assignDietMutation.mutate()}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" /> Assign
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Notification title..."
            className="h-9 flex-1 text-xs"
            value={notifyTitle}
            onChange={(e) => setNotifyTitle(e.target.value)}
          />
          <Button size="sm" disabled={!notifyTitle || notifyMutation.isPending} onClick={() => notifyMutation.mutate()}>
            <Bell className="h-3.5 w-3.5" /> Notify
          </Button>
        </div>
        {feedback && <p className="text-xs text-accent-2">{feedback}</p>}
      </div>
    </Card>
  );
}

export function SegmentsPage() {
  const queryClient = useQueryClient();
  const { data: segments } = useQuery({ queryKey: ["admin-segments"], queryFn: listSegments });
  const { register, control, handleSubmit, reset } = useForm<FormValues>();

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const rules: Record<string, unknown> = {};
      if (values.fitnessGoal) rules.fitnessGoal = values.fitnessGoal;
      if (values.experienceLevel) rules.experienceLevel = values.experienceLevel;
      if (values.gender) rules.gender = values.gender;
      if (values.ageMin) rules.ageMin = Number(values.ageMin);
      if (values.ageMax) rules.ageMax = Number(values.ageMax);
      if (values.membershipStatus) rules.membershipStatus = values.membershipStatus;
      if (values.inactiveDays) rules.inactiveDays = Number(values.inactiveDays);
      return createSegment({ name: values.name, description: values.description || undefined, rules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-segments"] });
      reset();
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">User Segments</h1>
      <p className="mt-1 text-muted">Target plans, missions, and notifications at rule-matched groups of users.</p>

      <Card className="mt-6">
        <CardTitle>New segment</CardTitle>
        <form
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <Input placeholder="Segment name" {...register("name", { required: true })} />
          <Input placeholder="Description (optional)" {...register("description")} />

          <FormSelect control={control} name="fitnessGoal" aria-label="Fitness goal" options={[{ value: "", label: "Any fitness goal" }, { value: "WEIGHT_LOSS", label: "Weight loss" }, { value: "MUSCLE_GAIN", label: "Muscle gain" }, { value: "MAINTENANCE", label: "Maintenance" }, { value: "ENDURANCE", label: "Endurance" }, { value: "GENERAL_FITNESS", label: "General fitness" }]} />
          <FormSelect control={control} name="experienceLevel" aria-label="Experience level" options={[{ value: "", label: "Any experience level" }, { value: "BEGINNER", label: "Beginner" }, { value: "INTERMEDIATE", label: "Intermediate" }, { value: "ADVANCED", label: "Advanced" }]} />
          <FormSelect control={control} name="gender" aria-label="Gender" options={[{ value: "", label: "Any gender" }, { value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }]} />
          <FormSelect control={control} name="membershipStatus" aria-label="Membership status" options={[{ value: "", label: "Any membership status" }, { value: "ACTIVE", label: "Active" }, { value: "EXPIRED", label: "Expired" }, { value: "NONE", label: "No membership" }]} />
          <Input placeholder="Min age (optional)" type="number" {...register("ageMin")} />
          <Input placeholder="Max age (optional)" type="number" {...register("ageMax")} />
          <Input placeholder="Inactive for N days (optional)" type="number" {...register("inactiveDays")} />

          <Button type="submit" className="sm:col-span-2" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" /> {createMutation.isPending ? "Creating..." : "Create segment"}
          </Button>
        </form>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {segments?.map((segment) => (
          <SegmentCard key={segment.id} segment={segment} />
        ))}
      </div>
    </div>
  );
}
