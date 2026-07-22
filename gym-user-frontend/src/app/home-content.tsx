"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Dumbbell, LineChart, Star, UtensilsCrossed } from "lucide-react";
import { getCmsPage, listTestimonials } from "@/lib/cms-api";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const FALLBACK = {
  headline: "Your fitness journey, all in one place",
  subtext: "Workouts, nutrition, membership, and progress tracking — built for people who actually show up.",
  ctaText: "Get started",
};

export function HomeContent() {
  const { data: page } = useQuery({ queryKey: ["cms-page", "home"], queryFn: () => getCmsPage("home") });
  const { data: testimonials } = useQuery({ queryKey: ["testimonials"], queryFn: listTestimonials });

  const headline = page?.content.headline || FALLBACK.headline;
  const subtext = page?.content.subtext || FALLBACK.subtext;
  const ctaText = page?.content.ctaText || FALLBACK.ctaText;
  const [headlineFirst, ...headlineRest] = headline.split(" all in one place");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        {page?.content.bannerImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.content.bannerImageUrl}
            alt=""
            className="mx-auto mb-6 h-40 w-40 rounded-3xl object-cover shadow-lg"
          />
        )}
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {headlineRest.length > 0 ? (
            <>
              {headlineFirst}
              <br />
              <span className="accent-gradient bg-clip-text text-transparent">all in one place</span>
              {headlineRest.join("")}
            </>
          ) : (
            headline
          )}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">{subtext}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register">
            <Button size="lg">
              {ctaText} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/exercises">
            <Button variant="glass" size="lg">
              Browse exercises
            </Button>
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <Card>
          <Dumbbell className="h-6 w-6 text-accent" />
          <CardTitle className="mt-3">Workout plans</CardTitle>
          <CardDescription className="mt-1">
            Follow admin-built programs or design your own, tracked set by set.
          </CardDescription>
        </Card>
        <Card>
          <UtensilsCrossed className="h-6 w-6 text-accent-2" />
          <CardTitle className="mt-3">Diet & nutrition</CardTitle>
          <CardDescription className="mt-1">
            Log meals against a real food database and watch your daily totals add up.
          </CardDescription>
        </Card>
        <Card>
          <LineChart className="h-6 w-6 text-accent" />
          <CardTitle className="mt-3">Progress tracking</CardTitle>
          <CardDescription className="mt-1">
            Streaks, missions, and a dashboard that reflects your real numbers.
          </CardDescription>
        </Card>
      </motion.div>

      {testimonials && testimonials.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-16"
        >
          <h2 className="text-center text-sm font-medium uppercase tracking-wide text-muted">What members say</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {testimonials.slice(0, 3).map((t) => (
              <Card key={t.id} className="flex flex-col gap-3">
                {t.rating && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                    ))}
                  </div>
                )}
                <CardDescription>&ldquo;{t.content}&rdquo;</CardDescription>
                <div className="text-sm font-medium">
                  {t.name}
                  {t.role && <span className="ml-1 text-xs text-muted">· {t.role}</span>}
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
