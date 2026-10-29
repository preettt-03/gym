import type { Metadata } from "next";
import { GalleryContent } from "./gallery-content";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photos from the King's Fitness community — facilities, events, and member transformations.",
  openGraph: { ...sharedOpenGraph, title: "Gallery | King's Fitness", url: "/gallery" },
};

export default function GalleryPage() {
  return <GalleryContent />;
}
