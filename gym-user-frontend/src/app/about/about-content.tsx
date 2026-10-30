"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getCmsPage } from "@/lib/cms-api";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import gymInterior from "@/assets/images/gym-interior.jpg";
import trainingRopes from "@/assets/images/training-ropes.jpg";

const FALLBACK_BODY =
  "King's Fitness is a neighbourhood gym on Dharmat Road in Fatehabad, Madhya Pradesh, built on a simple idea — fitness shouldn't feel complicated or intimidating. Everyone deserves the right guidance, the right environment and a plan that works for them.\n\nWe offer Crossfit, kickboxing, cycling, dance fitness, adult sports, personal training and nutrition consulting — and our member app gives you workout plans, nutrition tracking and progress tools so you always know what to do next.";

const VALUES = [
  { title: "Expert coaching", body: "Certified trainers who build plans around you." },
  { title: "Real results", body: "Track every set, meal and measurement." },
  { title: "Community", body: "A gym floor that pushes you to show up." },
];

export function AboutContent() {
  const { data: page, isLoading } = useQuery({ queryKey: ["cms-page", "about"], queryFn: () => getCmsPage("about") });
  const banner = page?.content.bannerImageUrl;

  return (
    <>
      <PageHero eyebrow="About us" title={page?.title || "About Us"} description="Built from a passion for better fitness." image={trainingRopes} />

      <section className="mx-auto grid max-w-7xl items-start gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2">
        <Reveal className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border">
          {banner ? (
            // CMS banners can be hosted anywhere, so skip next/image's domain allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner} alt="" className="h-full w-full object-cover" />
          ) : (
            <Image src={gymInterior} alt="The King's Fitness training floor" fill placeholder="blur" sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          )}
        </Reveal>

        <Reveal delay={0.1}>
          <p className="eyebrow">Our story</p>
          {isLoading ? (
            <div className="mt-6 flex flex-col gap-3" aria-label="Loading">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-foreground/85">
              {page?.content.body || page?.content.subtext || FALLBACK_BODY}
            </p>
          )}
        </Reveal>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-24 sm:px-6 md:grid-cols-3">
        {VALUES.map((v, i) => (
          <Reveal key={v.title} delay={i * 0.08}>
            <div className="glass-card card-hover h-full p-7">
              <span className="font-display text-4xl font-bold text-gold/40">0{i + 1}</span>
              <h2 className="mt-3 text-xl font-semibold uppercase">{v.title}</h2>
              <p className="mt-2 text-sm text-muted">{v.body}</p>
            </div>
          </Reveal>
        ))}
      </section>
    </>
  );
}
