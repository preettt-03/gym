"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { LogoMark } from "@/components/logo";
import { BRAND } from "@/lib/brand";
import authSide from "@/assets/images/auth-side.jpg";

// Split layout shared by login / register: brand photo on large screens,
// form card on the right (full width on mobile).
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid min-h-[calc(100svh-4.5rem)] lg:grid-cols-2">
      <div className="relative isolate hidden overflow-hidden lg:block">
        <Image src={authSide} alt="" fill preload placeholder="blur" sizes="50vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/40 to-background/10" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <LogoMark className="h-14 w-14" />
          <p className="mt-6 max-w-md font-display text-4xl font-bold uppercase leading-tight">
            The body achieves what the mind <span className="text-gold">believes.</span>
          </p>
          <p className="mt-4 text-sm uppercase tracking-[0.3em] text-gold">{BRAND.tagline}</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-14 sm:px-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <p className="eyebrow">{BRAND.name}</p>
          <h1 className="mt-4 text-4xl font-bold uppercase">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}
