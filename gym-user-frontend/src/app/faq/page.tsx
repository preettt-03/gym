import type { Metadata } from "next";
import { FaqContent } from "./faq-content";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Gym Platform membership, workouts, and features.",
  openGraph: { ...sharedOpenGraph, title: "FAQ | Gym Platform", url: "/faq" },
};

export default function FaqPage() {
  return <FaqContent />;
}
