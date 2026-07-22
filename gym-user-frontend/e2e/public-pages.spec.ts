import { test, expect } from "@playwright/test";

test.describe("Public marketing pages", () => {
  test("home page loads with the hero and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Get started/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse exercises/i })).toBeVisible();
  });

  test("exercise library is browsable without logging in", async ({ page }) => {
    await page.goto("/exercises");
    await expect(page.getByText("Exercise Library")).toBeVisible();
    await expect(page.getByPlaceholder("Search exercises...")).toBeVisible();
  });

  test("pricing page lists membership plans", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Membership Plans")).toBeVisible();
  });

  test("about, faq, blog, and gallery pages all return real content", async ({ page }) => {
    for (const path of ["/about", "/faq", "/blog", "/gallery"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
    }
  });

  test("manifest, robots, and sitemap are served", async ({ page }) => {
    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);

    const robots = await page.request.get("/robots.txt");
    expect(robots.status()).toBe(200);

    const sitemap = await page.request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
  });
});
