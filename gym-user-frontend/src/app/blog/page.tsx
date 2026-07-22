import type { Metadata } from "next";
import { BlogContent } from "./blog-content";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "Blog",
  description: "Fitness tips, nutrition advice, and updates from the Gym Platform team.",
  openGraph: { ...sharedOpenGraph, title: "Blog | Gym Platform", url: "/blog" },
};

export default function BlogPage() {
  return <BlogContent />;
}
