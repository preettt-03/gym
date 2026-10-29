import type { Metadata } from "next";
import { FaqContent } from "./faq-content";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about King's Fitness membership, workouts, and features.",
  openGraph: { ...sharedOpenGraph, title: "FAQ | King's Fitness", url: "/faq" },
};

export default function FaqPage() {
  return <FaqContent />;
}
