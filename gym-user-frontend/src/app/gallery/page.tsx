import type { Metadata } from "next";
import { GalleryContent } from "./gallery-content";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photos from the Gym Platform community — facilities, events, and member transformations.",
  openGraph: { ...sharedOpenGraph, title: "Gallery | Gym Platform", url: "/gallery" },
};

export default function GalleryPage() {
  return <GalleryContent />;
}
