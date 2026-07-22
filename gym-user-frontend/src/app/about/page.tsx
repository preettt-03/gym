import type { Metadata } from "next";
import { AboutContent } from "./about-content";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Gym Platform — built for people who show up consistently, with real workout plans, nutrition tracking, and an accountable community.",
  openGraph: { ...sharedOpenGraph, title: "About Us | Gym Platform", url: "/about" },
};

export default function AboutPage() {
  return <AboutContent />;
}
