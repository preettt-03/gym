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
    await expect(page.getByLabel("Search exercises")).toBeVisible();
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

  test("exercise library filters by muscle group and opens a detail page", async ({ page }) => {
    await page.goto("/exercises");
    await page.getByRole("group", { name: "Exercise filters" }).getByRole("button", { name: "Chest" }).click();
    await expect(page.getByRole("group", { name: "Exercise filters" }).getByRole("button", { name: "Chest" })).toHaveAttribute("aria-pressed", "true");
    const cards = page.locator("main article, article").filter({ has: page.getByRole("link") });
    await expect(cards.first()).toBeVisible();
    // Every card left is a chest exercise (seed: bench press, push-up).
    for (const name of await cards.getByRole("heading").allInnerTexts()) expect(name).toMatch(/BENCH|PUSH|CHEST|FLY|DIP/i);

    await cards.first().getByRole("link").click();
    await expect(page.getByText("Primary muscle")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to do it" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Common mistakes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coach's tip" })).toBeVisible();
  });

  test("difficulty filter takes several levels at once", async ({ page }) => {
    await page.goto("/exercises");
    await page.getByRole("button", { name: "Level" }).click();
    await page.getByLabel("Beginner").check();
    await page.getByLabel("Advanced").check();
    await expect(page.getByRole("button", { name: /Level\s*2/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Beginner")).toHaveCount(0);

    const badges = page.locator("article").getByText(/^(Beginner|Intermediate|Advanced)$/);
    await expect(badges.first()).toBeVisible();
    for (const level of await badges.allInnerTexts()) expect(["BEGINNER", "ADVANCED"]).toContain(level.toUpperCase());
  });

  test("muscle group chips slide with arrows when they don't fit", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/exercises");
    const right = page.getByRole("button", { name: "Scroll muscle group right" });
    await expect(right).toBeVisible();
    await expect(page.getByRole("button", { name: "Scroll muscle group left" })).toHaveCount(0);
    await right.click();
    await expect(page.getByRole("button", { name: "Scroll muscle group left" })).toBeVisible();
    await page.getByRole("group", { name: "Exercise filters" }).getByRole("button", { name: "Core" }).click();
    await expect(page.getByRole("group", { name: "Exercise filters" }).getByRole("button", { name: "Core" })).toHaveAttribute("aria-pressed", "true");
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
