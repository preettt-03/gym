import type { Metadata } from "next";

// Reception TV screens: never indexed, and the URL carries a secret key.
export const metadata: Metadata = {
  title: "Live leaderboard",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
