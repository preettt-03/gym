import Link from "next/link";
import { Check } from "lucide-react";
import type { MembershipPlan } from "@/lib/membership-api";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function finalPrice(plan: MembershipPlan) {
  if (!plan.discountPercent) return plan.price;
  return Math.round(plan.price - (plan.price * plan.discountPercent) / 100);
}

const inr = new Intl.NumberFormat("en-IN");

function durationLabel(days: number) {
  if (days % 365 === 0) return days === 365 ? "year" : `${days / 365} years`;
  if (days % 30 === 0) return days === 30 ? "month" : `${days / 30} months`;
  return `${days} days`;
}

export function PlanCard({
  plan,
  featured = false,
  href,
  cta,
}: {
  plan: MembershipPlan;
  featured?: boolean;
  href: string;
  cta: string;
}) {
  const price = finalPrice(plan);

  return (
    <article
      className={cn(
        "glass-card card-hover relative flex flex-col p-7",
        featured && "border-gold/70 bg-linear-to-b from-gold/10 to-surface"
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-7 rounded-full bg-gold px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-accent-foreground">
          Most popular
        </span>
      )}
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">{plan.name}</h3>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-5xl font-bold">₹{inr.format(price)}</span>
        <span className="text-sm text-muted">/ {durationLabel(plan.durationDays)}</span>
      </div>
      {plan.discountPercent ? (
        <p className="mt-1 text-sm text-muted">
          <span className="line-through">₹{inr.format(plan.price)}</span>
          <span className="ml-2 text-gold">Save {plan.discountPercent}%</span>
        </p>
      ) : null}
      {plan.description && <p className="mt-4 text-sm text-muted">{plan.description}</p>}

      <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-border pt-6">
        {plan.benefits.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold/15">
              <Check className="h-3 w-3 text-gold" />
            </span>
            {b}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={cn(buttonVariants({ variant: featured ? "default" : "outline" }), "mt-8 w-full uppercase tracking-wider")}
      >
        {cta}
      </Link>
    </article>
  );
}

export function PlanCardSkeleton() {
  return (
    <div className="glass-card flex flex-col gap-4 p-7" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-40" />
      <Skeleton className="h-4 w-full" />
      <div className="mt-2 flex flex-col gap-3 border-t border-border pt-6">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="mt-4 h-11 w-full rounded-xl" />
    </div>
  );
}

// Grid layout that keeps one or two plans centered instead of left-aligned.
export function planGridClass(count: number) {
  if (count === 1) return "mx-auto grid max-w-sm grid-cols-1 gap-6";
  if (count === 2) return "mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2";
  return "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3";
}
