"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { getCmsPage } from "@/lib/cms-api";
import { BRAND } from "@/lib/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/images/hero.jpg";

// Admins can override these from the CMS "home" page.
const FALLBACK = {
  headline: "The body achieves what the mind believes",
  subtext:
    "Expert coaching, structured workout and diet plans, and progress tracking that keeps you accountable — all under one roof.",
  ctaText: "Get started",
};

const STATS = [
  { value: `${BRAND.rating.score} ★`, label: `${BRAND.rating.source} rating` },
  { value: "5:00 AM", label: "Doors open" },
  { value: `${BRAND.services.length}+`, label: "Training styles" },
  { value: "1:1", label: "Personal training" },
];

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { data: page } = useQuery({ queryKey: ["cms-page", "home"], queryFn: () => getCmsPage("home") });

  const headline = page?.content.headline || FALLBACK.headline;
  const subtext = page?.content.subtext || FALLBACK.subtext;
  const ctaText = page?.content.ctaText || FALLBACK.ctaText;

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {}
      : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay } };

  return (
    <section className="relative isolate flex min-h-[calc(100svh-4.5rem)] flex-col justify-between overflow-hidden">
      <Image
        src={page?.content.bannerImageUrl || heroImage}
        alt="Athlete training with a dumbbell in a dark gym"
        fill
        preload
        placeholder={page?.content.bannerImageUrl ? "empty" : "blur"}
        unoptimized={Boolean(page?.content.bannerImageUrl)}
        sizes="100vw"
        quality={75}
        className="-z-20 object-cover object-[70%_center]"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-background via-background/80 to-background/20" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-linear-to-t from-background to-transparent" />

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-20 sm:px-6 sm:pt-28">
        <motion.p className="eyebrow" {...fadeUp(0)}>
          King&apos;s Fitness · Fatehabad
        </motion.p>
        <motion.h1
          className="mt-6 max-w-3xl text-5xl font-bold uppercase leading-[1.05] sm:text-6xl lg:text-7xl"
          {...fadeUp(0.1)}
        >
          {headline}
          <span className="text-gold">.</span>
        </motion.h1>
        <motion.p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/75" {...fadeUp(0.2)}>
          {subtext}
        </motion.p>
        <motion.div className="mt-10 flex flex-wrap gap-4" {...fadeUp(0.3)}>
          <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "uppercase tracking-wider")}>
            {ctaText} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/exercises" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "uppercase tracking-wider")}>
            Browse exercises
          </Link>
        </motion.div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-background/80 px-6 py-5 backdrop-blur-sm">
              <dt className="text-xs uppercase tracking-widest text-muted">{s.label}</dt>
              <dd className="mt-1 font-display text-3xl font-bold text-gold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
