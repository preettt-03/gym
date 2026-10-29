"use client";

import { useQuery } from "@tanstack/react-query";
import { listGalleryImages } from "@/lib/cms-api";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/reveal";
import { Card, CardDescription } from "@/components/ui/card";
import { SkeletonGrid } from "@/components/ui/skeleton";
import programEquipment from "@/assets/images/program-equipment.jpg";

export function GalleryContent() {
  const { data: images, isLoading } = useQuery({ queryKey: ["gallery"], queryFn: listGalleryImages });

  return (
    <>
      <PageHero eyebrow="Gallery" title="Inside King's Fitness" description="A look at our floor, our members and the work they put in." image={programEquipment} />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        {isLoading && <SkeletonGrid count={8} className="lg:grid-cols-4" />}
        {images?.length === 0 && (
          <Card className="mx-auto max-w-md text-center">
            <CardDescription>No photos yet.</CardDescription>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images?.map((img, i) => (
            <Reveal key={img.id} delay={Math.min(i * 0.03, 0.3)}>
              <figure className="group relative overflow-hidden rounded-2xl border border-border bg-surface-2">
                {/* Gallery uploads can be hosted anywhere, so skip next/image's domain allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl}
                  alt={img.caption ?? ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {img.caption && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background to-transparent px-3 pb-3 pt-8 text-xs">
                    {img.caption}
                  </figcaption>
                )}
              </figure>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
