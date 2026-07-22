import type { Metadata } from "next";
import { HomeContent } from "./home-content";
import { sharedOpenGraph } from "./shared-metadata";

export const metadata: Metadata = {
  title: "Gym Platform — Workouts, Diet Plans & AI Coaching",
  description:
    "Your fitness journey, all in one place. Workouts, nutrition, membership, and progress tracking — built for people who actually show up.",
  openGraph: { ...sharedOpenGraph, title: "Gym Platform", url: "/" },
  alternates: { canonical: "/" },
};

export default function Home() {
  return <HomeContent />;
}
