import type { Metadata } from "next";
import { BlogContent } from "./blog-content";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "Blog",
  description: "Fitness tips, nutrition advice, and updates from the King's Fitness team.",
  openGraph: { ...sharedOpenGraph, title: "Blog | King's Fitness", url: "/blog" },
};

export default function BlogPage() {
  return <BlogContent />;
}
