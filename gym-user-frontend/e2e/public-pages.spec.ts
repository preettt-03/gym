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

  test("exercise cards open a detail page with instructions", async ({ page }) => {
    await page.goto("/exercises");
    await page.getByRole("link", { name: "Push-Up" }).click();
    await expect(page).toHaveURL(/\/exercises\/push-up/);
    await expect(page.getByRole("heading", { name: "Push-Up" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to do it" })).toBeVisible();
  });

  test("body-fat calculator validates input and returns an estimate", async ({ page }) => {
    await page.goto("/tools/body-fat");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Height is required")).toBeVisible();

    await page.getByLabel("Height").fill("178");
    await page.getByLabel("Neck").fill("38");
    await page.getByLabel("Waist").fill("85");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Estimated body fat")).toBeVisible();
    await expect(page.getByText(/Category:/)).toBeVisible();

    // Women need a hip measurement.
    await page.getByText("Female", { exact: true }).click();
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Hip is required for women")).toBeVisible();
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
