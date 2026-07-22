"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { listFaqs } from "@/lib/cms-api";
import { Card, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FaqContent() {
  const { data: faqs, isLoading } = useQuery({ queryKey: ["faqs"], queryFn: listFaqs });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold">
        Frequently Asked Questions
      </motion.h1>

      {isLoading && <p className="mt-6 text-muted">Loading...</p>}
      {faqs?.length === 0 && (
        <Card className="mt-6">
          <CardDescription>No FAQs published yet.</CardDescription>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {faqs?.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <Card key={faq.id} className="cursor-pointer" onClick={() => setOpenId(isOpen ? null : faq.id)}>
              <div className="flex items-center justify-between">
                <div className="font-medium">{faq.question}</div>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
              </div>
              {isOpen && <CardDescription className="mt-3">{faq.answer}</CardDescription>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
