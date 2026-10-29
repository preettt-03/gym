"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { listBlogPosts } from "@/lib/cms-api";
import { PageHero } from "@/components/page-hero";
import { Reveal } from "@/components/reveal";
import { Card, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import programPersonal from "@/assets/images/program-personal.jpg";

export function BlogContent() {
  const { data: posts, isLoading } = useQuery({ queryKey: ["blog-posts"], queryFn: listBlogPosts });

  return (
    <>
      <PageHero eyebrow="Blog" title="Training & nutrition tips" description="Guides and advice from our coaches." image={programPersonal} />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        {posts?.length === 0 && (
          <Card className="mx-auto max-w-md text-center">
            <CardDescription>No posts published yet.</CardDescription>
          </Card>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card overflow-hidden" aria-hidden="true">
                <Skeleton className="aspect-video rounded-none" />
                <div className="flex flex-col gap-3 p-6">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}

          {posts?.map((post, i) => (
            <Reveal key={post.id} delay={Math.min(i * 0.06, 0.3)}>
              <Link href={`/blog/${post.slug}`} className="glass-card card-hover group flex h-full flex-col overflow-hidden">
                <div className="aspect-video overflow-hidden bg-surface-2">
                  {post.coverImageUrl && (
                    // Covers are admin uploads on arbitrary hosts, so skip next/image's domain allowlist.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <time dateTime={post.publishedAt} className="text-xs uppercase tracking-widest text-gold">
                    {format(new Date(post.publishedAt), "PPP")}
                  </time>
                  <h2 className="mt-2 text-xl font-semibold">{post.title}</h2>
                  {post.excerpt && <p className="mt-2 flex-1 text-sm text-muted">{post.excerpt}</p>}
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gold">
                    Read more <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
