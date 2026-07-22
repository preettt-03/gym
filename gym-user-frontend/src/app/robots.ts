import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated app screens have nothing to offer a crawler and
      // shouldn't be indexed.
      disallow: [
        "/dashboard",
        "/workout-plans",
        "/diet-plans",
        "/nutrition",
        "/progress",
        "/attendance",
        "/membership",
        "/achievements",
        "/settings",
        "/chat",
        "/ai-coach",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
