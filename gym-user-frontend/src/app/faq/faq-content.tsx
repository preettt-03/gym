"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { listFaqs } from "@/lib/cms-api";
import { PageHero } from "@/components/page-hero";
import { Card, CardDescription } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function FaqContent() {
  const { data: faqs, isLoading } = useQuery({ queryKey: ["faqs"], queryFn: listFaqs });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently Asked Questions" description="Everything you need to know before you start training with us." />

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        {isLoading && <SkeletonList rows={4} />}
        {faqs?.length === 0 && (
          <Card>
            <CardDescription>No FAQs published yet.</CardDescription>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {faqs?.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div key={faq.id} className={cn("glass-card transition-colors", isOpen && "border-gold/50")}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${faq.id}`}
                  className="flex w-full items-center justify-between gap-4 p-6 text-left font-medium"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                >
                  {faq.question}
                  <ChevronDown className={cn("h-5 w-5 shrink-0 text-gold transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <p id={`faq-${faq.id}`} className="-mt-2 px-6 pb-6 text-sm leading-relaxed text-muted">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
