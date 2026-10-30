import { test, expect } from "@playwright/test";

test.describe("Fitness tools", () => {
  test("hub lists the live tools and filters by category", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByRole("heading", { name: /Fitness tools & calculators/i })).toBeVisible();
    const cards = page.locator("main article, article");
    await expect(cards).toHaveCount(10);

    await page.getByRole("group", { name: "Category" }).getByRole("button", { name: "Strength" }).click();
    await expect(cards).toHaveCount(2);
    await cards.getByRole("link", { name: /One Rep Max/i }).click();
    await expect(page).toHaveURL(/\/tools\/1rm$/);
  });

  test("1RM estimates a max and a percentage table", async ({ page }) => {
    await page.goto("/tools/1rm");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Weight is required")).toBeVisible();

    await page.getByLabel("Weight lifted").fill("100");
    await page.getByLabel("Reps completed").fill("5");
    await page.getByRole("combobox", { name: "Formula" }).click();
    await page.getByRole("option", { name: "Epley" }).click();
    await page.getByRole("button", { name: "Calculate" }).click();
    // Epley: 100 × (1 + 5/30) = 116.7
    await expect(page.getByText("116.7", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Training loads by percentage" }).getByRole("listitem")).toHaveCount(9);
  });

  test("plate loader picks plates per side and flags impossible loads", async ({ page }) => {
    await page.goto("/tools/plate-loader");
    await page.getByLabel("Target weight").fill("100");
    await page.getByRole("button", { name: "Calculate" }).click();
    // (100 − 20) / 2 = 40 → 25 + 15
    await expect(page.getByRole("img", { name: "Each side: 25, 15 kg" })).toBeVisible();

    await page.getByRole("button", { name: "15 kg", exact: true }).click(); // no 15s in this gym
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByRole("img", { name: "Each side: 25, 10, 5 kg" })).toBeVisible();

    await page.getByLabel("Target weight").fill("101");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText(/Can't make exactly 101 kg/)).toBeVisible();
  });

  test("BMI, heart-rate zones and the rest timer work", async ({ page }) => {
    await page.goto("/tools/bmi");
    await page.getByLabel("Height").fill("180");
    await page.getByLabel("Weight").fill("75");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("23.1", { exact: true })).toBeVisible();
    await expect(page.getByText("Normal").first()).toBeVisible();

    await page.goto("/tools/heart-rate");
    await page.getByLabel("Age").fill("30");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("187", { exact: true })).toBeVisible(); // 208 − 0.7 × 30
    await expect(page.getByText("Fat burn")).toBeVisible();

    await page.goto("/tools/timer");
    await page.getByRole("button", { name: "30s" }).click();
    await expect(page.getByRole("timer")).toHaveText("0:30");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("timer")).not.toHaveText("0:30", { timeout: 3000 });
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });
});
