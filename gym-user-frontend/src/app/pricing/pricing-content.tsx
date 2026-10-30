"use client";

import { useQuery } from "@tanstack/react-query";
import { listMembershipPlans } from "@/lib/membership-api";
import { useAuthStore } from "@/stores/auth-store";
import { PageHero } from "@/components/page-hero";
import { PlanCard, PlanCardSkeleton, planGridClass } from "@/components/plan-card";
import { Reveal } from "@/components/reveal";
import { Card, CardDescription } from "@/components/ui/card";
import statsBg from "@/assets/images/stats-bg.jpg";

export function PricingContent() {
  const user = useAuthStore((s) => s.user);
  const { data: plans, isLoading, isError } = useQuery({ queryKey: ["membership-plans"], queryFn: listMembershipPlans });

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Membership Plans"
        description="Simple pricing. Cancel anytime. Every plan includes full access to the King's Fitness member app."
        image={statsBg}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        {isError && (
          <Card className="mx-auto max-w-md text-center">
            <CardDescription>Couldn&apos;t load plans right now. Please try again shortly.</CardDescription>
          </Card>
        )}
        {plans?.length === 0 && (
          <Card className="mx-auto max-w-md text-center">
            <CardDescription>No plans available right now.</CardDescription>
          </Card>
        )}

        <div className={planGridClass(isLoading ? 3 : plans?.length ?? 0)}>
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <PlanCardSkeleton key={i} />)
            : plans?.map((plan, i, all) => (
                <Reveal key={plan.id} delay={Math.min(i * 0.08, 0.3)} className="h-full">
                  <PlanCard
                    plan={plan}
                    featured={all.length === 3 && i === 1}
                    href={user ? "/membership" : "/register"}
                    cta={user ? "Manage membership" : "Join now"}
                  />
                </Reveal>
              ))}
        </div>
      </section>
    </>
  );
}
