"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { listMembershipPlans, type MembershipPlan } from "@/lib/membership-api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function finalPrice(plan: MembershipPlan) {
  if (!plan.discountPercent) return plan.price;
  return Math.round(plan.price - (plan.price * plan.discountPercent) / 100);
}

export function PricingContent() {
  const user = useAuthStore((s) => s.user);
  const { data: plans, isLoading } = useQuery({ queryKey: ["membership-plans"], queryFn: listMembershipPlans });

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="text-3xl font-semibold">Membership Plans</h1>
        <p className="mt-2 text-muted">Simple pricing. Cancel anytime.</p>
      </motion.div>

      {isLoading && <p className="mt-8 text-center text-muted">Loading plans...</p>}
      {plans?.length === 0 && <p className="mt-8 text-center text-muted">No plans available right now.</p>}

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className="flex flex-col gap-3">
            <CardTitle>{plan.name}</CardTitle>
            {plan.description && <CardDescription>{plan.description}</CardDescription>}
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold">₹{finalPrice(plan)}</span>
              {plan.discountPercent ? <span className="text-sm text-muted line-through">₹{plan.price}</span> : null}
            </div>
            <div className="text-xs text-muted">{plan.durationDays} days access</div>
            {plan.benefits.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1.5">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 className="h-4 w-4 text-accent-2" /> {b}
                  </li>
                ))}
              </ul>
            )}
            <Link href={user ? "/membership" : "/register"} className="mt-2">
              <Button className="w-full">{user ? "Manage membership" : "Get started"}</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
