"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Bell, BellOff } from "lucide-react";
import { getMyProfile, updateMyProfile, type UpdateProfileInput } from "@/lib/profile-api";
import {
  getCurrentSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/require-auth";

function PushNotificationsCard() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      setLoading(false);
      return;
    }
    getCurrentSubscription()
      .then((sub) => setSubscribed(Boolean(sub)))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle() {
    setError(null);
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
      return;
    }
    const result = await subscribeToPush();
    if (result.ok) {
      setSubscribed(true);
    } else {
      setError(result.reason ?? "Could not enable notifications.");
    }
  }

  if (!supported || loading) return null;

  return (
    <Card className="mt-6">
      <CardTitle className="flex items-center gap-2">
        {subscribed ? <Bell className="h-4 w-4 text-accent" /> : <BellOff className="h-4 w-4 text-muted" />}
        Push notifications
      </CardTitle>
      <CardDescription className="mt-1 mb-3">
        Get workout reminders, membership alerts, and trainer notes even when the app is closed.
      </CardDescription>
      <Button variant={subscribed ? "glass" : "default"} size="sm" onClick={handleToggle}>
        {subscribed ? "Disable" : "Enable"} push notifications
      </Button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Card>
  );
}

interface FormValues {
  name: string;
  age: string;
  gender: UpdateProfileInput["gender"] | "";
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  fitnessGoal: UpdateProfileInput["fitnessGoal"] | "";
  experienceLevel: UpdateProfileInput["experienceLevel"] | "";
  activityLevel: UpdateProfileInput["activityLevel"] | "";
  gymName: string;
}

function toProfileInput(values: FormValues): UpdateProfileInput {
  const input: UpdateProfileInput = {};
  if (values.name) input.name = values.name;
  if (values.age) input.age = Number(values.age);
  if (values.gender) input.gender = values.gender;
  if (values.heightCm) input.heightCm = Number(values.heightCm);
  if (values.weightKg) input.weightKg = Number(values.weightKg);
  if (values.targetWeightKg) input.targetWeightKg = Number(values.targetWeightKg);
  if (values.fitnessGoal) input.fitnessGoal = values.fitnessGoal;
  if (values.experienceLevel) input.experienceLevel = values.experienceLevel;
  if (values.activityLevel) input.activityLevel = values.activityLevel;
  if (values.gymName) input.gymName = values.gymName;
  return input;
}

function SettingsContent() {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });

  const { register, handleSubmit, reset } = useForm<FormValues>();

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name ?? "",
        age: profile.age?.toString() ?? "",
        gender: profile.gender ?? "",
        heightCm: profile.heightCm?.toString() ?? "",
        weightKg: profile.weightKg?.toString() ?? "",
        targetWeightKg: profile.targetWeightKg?.toString() ?? "",
        fitnessGoal: (profile.fitnessGoal as FormValues["fitnessGoal"]) ?? "",
        experienceLevel: (profile.experienceLevel as FormValues["experienceLevel"]) ?? "",
        activityLevel: (profile.activityLevel as FormValues["activityLevel"]) ?? "",
        gymName: profile.gymName ?? "",
      });
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-semibold">
        Settings
      </motion.h1>
      <p className="mt-1 text-muted">Keep your fitness profile up to date for accurate calculations.</p>

      {profile && (
        <Card className="mt-6">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted">{profile.email}</div>
            <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">{profile.coins} coins</span>
            <span className="rounded-full bg-accent-2/15 px-2.5 py-1 text-xs text-accent-2">{profile.xp} XP</span>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <CardTitle>Profile</CardTitle>
        <CardDescription className="mt-1 mb-4">
          Used for BMI, BMR, and calorie calculations on your dashboard.
        </CardDescription>

        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => mutation.mutate(toProfileInput(values)))}
        >
          <Input placeholder="Name" {...register("name")} />
          <Input type="number" placeholder="Age" {...register("age")} />
          <select className="glass-input h-11 px-4 text-sm" {...register("gender")}>
            <option value="">Gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          <Input type="number" placeholder="Height (cm)" {...register("heightCm")} />
          <Input type="number" step="0.1" placeholder="Weight (kg)" {...register("weightKg")} />
          <Input type="number" step="0.1" placeholder="Target weight (kg)" {...register("targetWeightKg")} />
          <select className="glass-input h-11 px-4 text-sm" {...register("fitnessGoal")}>
            <option value="">Fitness goal</option>
            <option value="WEIGHT_LOSS">Weight loss</option>
            <option value="MUSCLE_GAIN">Muscle gain</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="ENDURANCE">Endurance</option>
            <option value="GENERAL_FITNESS">General fitness</option>
          </select>
          <select className="glass-input h-11 px-4 text-sm" {...register("experienceLevel")}>
            <option value="">Experience level</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
          <select className="glass-input h-11 px-4 text-sm sm:col-span-2" {...register("activityLevel")}>
            <option value="">Activity level</option>
            <option value="SEDENTARY">Sedentary</option>
            <option value="LIGHTLY_ACTIVE">Lightly active</option>
            <option value="MODERATELY_ACTIVE">Moderately active</option>
            <option value="VERY_ACTIVE">Very active</option>
            <option value="EXTRA_ACTIVE">Extra active</option>
          </select>
          <Input placeholder="Gym name" className="sm:col-span-2" {...register("gymName")} />

          <Button type="submit" className="sm:col-span-2" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
          {mutation.isSuccess && <p className="text-sm text-accent-2 sm:col-span-2">Profile updated.</p>}
        </form>
      </Card>

      <PushNotificationsCard />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}
