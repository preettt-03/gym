"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { listBlogPosts } from "@/lib/cms-api";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function BlogContent() {
  const { data: posts, isLoading } = useQuery({ queryKey: ["blog-posts"], queryFn: listBlogPosts });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold">
        Blog
      </motion.h1>

      {isLoading && <p className="mt-6 text-muted">Loading...</p>}
      {posts?.length === 0 && (
        <Card className="mt-6">
          <CardDescription>No posts published yet.</CardDescription>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {posts?.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`}>
            <Card className="flex flex-col gap-2 transition hover:brightness-105 sm:flex-row sm:items-center sm:gap-4">
              {post.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.coverImageUrl}
                  alt=""
                  className="h-32 w-full shrink-0 rounded-xl object-cover sm:h-20 sm:w-32"
                />
              )}
              <div>
                <CardTitle>{post.title}</CardTitle>
                {post.excerpt && <CardDescription className="mt-1">{post.excerpt}</CardDescription>}
                <div className="mt-2 text-xs text-muted">{format(new Date(post.publishedAt), "PPP")}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
