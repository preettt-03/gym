"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { listGalleryImages } from "@/lib/cms-api";
import { Card, CardDescription } from "@/components/ui/card";

export function GalleryContent() {
  const { data: images, isLoading } = useQuery({ queryKey: ["gallery"], queryFn: listGalleryImages });

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold">
        Gallery
      </motion.h1>

      {isLoading && <p className="mt-6 text-muted">Loading...</p>}
      {images?.length === 0 && (
        <Card className="mt-6">
          <CardDescription>No photos yet.</CardDescription>
        </Card>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images?.map((img, i) => (
          <motion.div
            key={img.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="glass-card overflow-hidden p-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.imageUrl} alt={img.caption ?? ""} className="aspect-square w-full object-cover" />
            {img.caption && <div className="px-3 py-2 text-xs text-muted">{img.caption}</div>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
