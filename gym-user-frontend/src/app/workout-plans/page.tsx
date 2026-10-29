"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Clock, Dumbbell, Flame, Sparkles, UserCheck } from "lucide-react";
import { listMyWorkoutPlans, type WorkoutPlanSummary } from "@/lib/workout-api";
import { RequireAuth } from "@/components/require-auth";
import { buttonVariants } from "@/components/ui/button";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { EmptyState, ErrorNote, MemberHeader, MemberPage } from "@/components/member/ui";
import { DifficultyBadge } from "@/components/exercise/exercise-card";
import { cn } from "@/lib/utils";

function PlanCard({ plan, tag }: { plan: WorkoutPlanSummary; tag: string }) {
  return (
    <article className="glass-card card-hover group relative flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
          <Dumbbell className="h-5 w-5 text-gold" />
        </span>
        <DifficultyBadge difficulty={plan.difficulty} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{tag}</p>
        <h3 className="mt-1 text-lg font-semibold uppercase leading-tight">
          <Link href={`/workout-plans/${plan.id}`} className="outline-none after:absolute after:inset-0 after:rounded-[inherit]">
            {plan.title}
          </Link>
        </h3>
        {plan.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{plan.description}</p>}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex gap-3">
          {plan.estimatedMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {plan.estimatedMinutes} min
            </span>
          )}
          {plan.estimatedCalories && (
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" /> {plan.estimatedCalories} kcal
            </span>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 text-gold transition-transform group-hover:translate-x-0.5" />
      </div>
    </article>
  );
}

function PlanGrid({ plans, tag }: { plans: WorkoutPlanSummary[]; tag: string }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((p) => (
        <li key={p.id}>
          <PlanCard plan={p} tag={tag} />
        </li>
      ))}
    </ul>
  );
}

function WorkoutPlansContent() {
  const { data, isPending, isError } = useQuery({ queryKey: ["workout-plans"], queryFn: listMyWorkoutPlans });

  return (
    <MemberPage>
      <MemberHeader
        eyebrow="Training"
        title="Workout Plans"
        description="Plans your coach assigned and plans you've built or generated."
        actions={
          <Link href="/workout-plans/generate" className={cn(buttonVariants(), "uppercase tracking-wider")}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Link>
        }
      />

      {isPending && <SkeletonGrid count={3} className="mt-8 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" itemClassName="h-48" />}
      {isError && (
        <div className="mt-8">
          <ErrorNote>Could not load your workout plans. Please try again.</ErrorNote>
        </div>
      )}

      {data && (
        <div className="mt-8 flex flex-col gap-10">
          <section aria-labelledby="assigned-plans">
            <h2 id="assigned-plans" className="mb-4 flex items-center gap-2 text-lg font-semibold uppercase">
              <UserCheck className="h-5 w-5 text-gold" /> From your coach
            </h2>
            {data.assignedPlans.length === 0 ? (
              <EmptyState title="No plans assigned yet" description="Your trainer or an admin can assign a program to you." />
            ) : (
              <PlanGrid plans={data.assignedPlans} tag="Assigned" />
            )}
          </section>

          <section aria-labelledby="own-plans">
            <h2 id="own-plans" className="mb-4 flex items-center gap-2 text-lg font-semibold uppercase">
              <Sparkles className="h-5 w-5 text-gold" /> Your own plans
            </h2>
            {data.ownedPlans.length === 0 ? (
              <EmptyState
                title="You haven't created a plan yet"
                description="Tell the AI your goal, schedule and equipment, and it will build a program for you."
                action={
                  <Link href="/workout-plans/generate" className={buttonVariants({ variant: "outline" })}>
                    <Sparkles className="h-4 w-4" /> Build one with AI
                  </Link>
                }
              />
            ) : (
              <PlanGrid plans={data.ownedPlans} tag="Custom" />
            )}
          </section>
        </div>
      )}
    </MemberPage>
  );
}

export default function WorkoutPlansPage() {
  return (
    <RequireAuth>
      <WorkoutPlansContent />
    </RequireAuth>
  );
}
