"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { getBlogPost } from "@/lib/cms-api";
import { Card, CardDescription } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => getBlogPost(slug),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
      {isLoading && <SkeletonList rows={2} />}
      {isError && <p className="text-danger">Could not find this post.</p>}

      {post && (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-semibold">{post.title}</h1>
            <div className="mt-2 text-sm text-muted">{format(new Date(post.publishedAt), "PPP")}</div>
          </motion.div>

          {post.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImageUrl} alt="" className="mt-6 h-64 w-full rounded-2xl object-cover" />
          )}

          <Card className="mt-6">
            <CardDescription className="whitespace-pre-line text-base leading-relaxed text-foreground">
              {post.content}
            </CardDescription>
          </Card>
        </>
      )}
    </div>
  );
}
