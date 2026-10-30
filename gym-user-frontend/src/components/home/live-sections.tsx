"use client";

import { useQuery } from "@tanstack/react-query";
import { Quote, Star } from "lucide-react";
import { listMembershipPlans } from "@/lib/membership-api";
import { listTestimonials } from "@/lib/cms-api";
import { useAuthStore } from "@/stores/auth-store";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { PlanCard, PlanCardSkeleton, planGridClass } from "@/components/plan-card";
import { Skeleton } from "@/components/ui/skeleton";

export function PlansSection() {
  const user = useAuthStore((s) => s.user);
  const { data: plans, isLoading, isError } = useQuery({ queryKey: ["membership-plans"], queryFn: listMembershipPlans });

  // Nothing to sell if the API is down or no plans are published.
  if (isError || (plans && plans.length === 0)) return null;

  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Membership"
          title={
            <>
              Member <span className="text-gold">price plan</span>
            </>
          }
          description="Simple, transparent pricing. No hidden fees — pick a plan and start training today."
        />
      </Reveal>

      <div className={`mt-14 ${planGridClass(isLoading ? 3 : plans!.length)}`}>
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <PlanCardSkeleton key={i} />)
          : plans!.slice(0, 3).map((plan, i, all) => (
              <Reveal key={plan.id} delay={i * 0.1} className="h-full">
                <PlanCard
                  plan={plan}
                  featured={all.length === 3 && i === 1}
                  href={user ? "/membership" : "/register"}
                  cta={user ? "Choose plan" : "Join now"}
                />
              </Reveal>
            ))}
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  const { data: testimonials, isLoading } = useQuery({ queryKey: ["testimonials"], queryFn: listTestimonials });

  // Hide the section entirely until real member reviews are published.
  if (!isLoading && !testimonials?.length) return null;

  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <Reveal>
          <SectionHeading
            eyebrow="Testimonials"
            title={
              <>
                What our <span className="text-gold">members say</span>
              </>
            }
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card flex flex-col gap-3 bg-background p-7" aria-hidden="true">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <div className="mt-4 flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              ))
            : testimonials!.slice(0, 3).map((t, i) => (
                <Reveal key={t.id} delay={i * 0.1}>
                  <figure className="glass-card card-hover relative flex h-full flex-col bg-background p-7">
                    <Quote className="absolute right-6 top-6 h-8 w-8 text-gold/20" />
                    {t.rating ? (
                      <div className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                        {Array.from({ length: t.rating }).map((_, s) => (
                          <Star key={s} className="h-4 w-4 fill-gold text-gold" />
                        ))}
                      </div>
                    ) : null}
                    <blockquote className="mt-4 flex-1 leading-relaxed text-foreground/85">&ldquo;{t.content}&rdquo;</blockquote>
                    <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                      {t.avatarUrl ? (
                        // Admin-uploaded avatars can live on any host, so skip next/image's domain allowlist.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.avatarUrl} alt="" loading="lazy" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 font-display text-lg text-gold">
                          {t.name.charAt(0)}
                        </span>
                      )}
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        {t.role && <div className="text-xs text-muted">{t.role}</div>}
                      </div>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
        </div>
      </div>
    </section>
  );
}
