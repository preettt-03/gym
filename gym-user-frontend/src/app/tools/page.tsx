"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calculator } from "lucide-react";
import { listTools, type ToolCategory } from "@/lib/tools-api";
import { CATEGORY_LABEL, TOOL_ICONS } from "@/components/tools/meta";
import { Chip } from "@/components/exercise/library-filters";
import { Skeleton } from "@/components/ui/skeleton";

export default function ToolsHubPage() {
  const [category, setCategory] = useState<ToolCategory | null>(null);
  const { data: tools, isPending, isError } = useQuery({ queryKey: ["tools"], queryFn: listTools });

  // Only offer chips for categories that actually have a live tool.
  const categories = [...new Set(tools?.map((t) => t.category))];
  const shown = tools?.filter((t) => !category || t.category === category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="eyebrow">Tools</p>
      <h1 className="mt-3 text-4xl font-bold uppercase sm:text-5xl">Fitness tools &amp; calculators</h1>
      <p className="mt-2 max-w-2xl text-muted">Work out your max, calories, macros, heart-rate zones and more — free, no account needed.</p>

      {categories.length > 1 && (
        <div role="group" aria-label="Category" className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={!category} onClick={() => setCategory(null)}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      )}

      {isPending && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      )}
      {isError && (
        <p role="alert" className="mt-8 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load the tools. Please try again in a moment.
        </p>
      )}
      {tools && tools.length === 0 && <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-14 text-center text-muted">No tools are available right now.</p>}

      {shown && shown.length > 0 && (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((tool) => {
            const Icon = TOOL_ICONS[tool.slug] ?? Calculator;
            return (
              <li key={tool.id}>
                <article className="glass-card group relative flex h-full flex-col p-6 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_0_15px_rgba(229,192,123,0.15)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 transition-colors group-hover:bg-gold/15">
                      <Icon className="h-7 w-7 text-gold" />
                    </span>
                    <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-gold-light">
                      {CATEGORY_LABEL[tool.category]}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-bold uppercase leading-tight">
                    <Link href={`/tools/${tool.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-[inherit]">
                      {tool.title}
                    </Link>
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-muted">{tool.description}</p>
                  <span aria-hidden className="mt-5 flex items-center gap-1.5 border-t border-border pt-4 text-sm font-bold uppercase tracking-wider text-gold">
                    Open tool <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
