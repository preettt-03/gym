"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getCmsPage } from "@/lib/cms-api";
import { Card, CardDescription } from "@/components/ui/card";

const FALLBACK_BODY =
  "We're building a gym platform for people who show up consistently — real workout plans, real nutrition tracking, and a community that keeps you accountable.";

export function AboutContent() {
  const { data: page, isLoading } = useQuery({ queryKey: ["cms-page", "about"], queryFn: () => getCmsPage("about") });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold">
        {page?.title || "About Us"}
      </motion.h1>

      {isLoading && <p className="mt-6 text-muted">Loading...</p>}

      {page?.content.bannerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.content.bannerImageUrl}
          alt=""
          className="mt-6 h-56 w-full rounded-2xl object-cover"
        />
      )}

      <Card className="mt-6">
        <CardDescription className="whitespace-pre-line text-base leading-relaxed text-foreground">
          {page?.content.body || page?.content.subtext || FALLBACK_BODY}
        </CardDescription>
      </Card>
    </div>
  );
}
