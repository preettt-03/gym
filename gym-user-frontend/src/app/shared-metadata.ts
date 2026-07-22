// Shared across layout.tsx and every page-level `metadata` export. Page
// metadata objects REPLACE (not merge with) the parent's `openGraph` field
// entirely once they declare their own `openGraph` — spreading this in keeps
// the shared image/site name while still letting each page set its own title.
export const sharedOpenGraph = {
  siteName: "Gym Platform",
  images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Gym Platform" }],
  type: "website" as const,
};
