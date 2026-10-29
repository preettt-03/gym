"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Users } from "lucide-react";
import { listTrainees } from "@/lib/trainer-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { RequireAuth } from "@/components/require-auth";
import { SkeletonList } from "@/components/ui/skeleton";

function TraineesContent() {
  const { data: trainees, isLoading, isError } = useQuery({ queryKey: ["trainer-trainees"], queryFn: listTrainees });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-2xl font-semibold"
      >
        <Users className="h-6 w-6 text-accent" /> My Trainees
      </motion.h1>
      <p className="mt-1 text-muted">Trainees assigned to you by an admin.</p>

      {isLoading && <SkeletonList rows={3} className="mt-8" />}
      {isError && <p className="mt-8 text-danger">Could not load trainees.</p>}
      {trainees?.length === 0 && (
        <Card className="mt-8">
          <CardDescription>No trainees assigned to you yet. Ask an admin to assign one.</CardDescription>
        </Card>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trainees?.map((trainee) => (
          <Link key={trainee.id} href={`/trainer/${trainee.id}`}>
            <Card className="flex h-full flex-col gap-2 transition hover:brightness-105">
              <CardTitle>{trainee.name || trainee.email}</CardTitle>
              <CardDescription>{trainee.email}</CardDescription>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                {trainee.fitnessGoal && <span>{trainee.fitnessGoal}</span>}
                {trainee.streak && (
                  <span className="flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5" /> {trainee.streak.currentStreak} day streak
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function TrainerTraineesPage() {
  return (
    <RequireAuth>
      <TraineesContent />
    </RequireAuth>
  );
}
