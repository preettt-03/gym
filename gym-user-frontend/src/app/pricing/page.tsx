import type { Metadata } from "next";
import { PricingContent } from "./pricing-content";
import { sharedOpenGraph } from "../shared-metadata";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple gym membership pricing. Cancel anytime. Compare plans and get started.",
  openGraph: { ...sharedOpenGraph, title: "Membership Plans | Gym Platform", url: "/pricing" },
};

export default function PricingPage() {
  return <PricingContent />;
}
