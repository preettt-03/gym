import { test, expect } from "@playwright/test";

// Uses the seeded admin account (created by `npm run prisma:seed` in
// gym-backend) rather than registering fresh, since these tests only need
// *some* logged-in session to exercise authenticated pages.
const ADMIN_EMAIL = "admin@gym.local";
const ADMIN_PASSWORD = "Admin@12345";

test.describe("Authenticated feature pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
    await page.locator("form").getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("dashboard shows stat cards and today's plan sections", async ({ page }) => {
    await expect(page.getByText("BMI")).toBeVisible();
    await expect(page.getByText("Current streak")).toBeVisible();
    await expect(page.getByText("Today's workout")).toBeVisible();
    await expect(page.getByText("Today's diet")).toBeVisible();
  });

  test("workout plans page loads and offers AI generation", async ({ page }) => {
    await page.goto("/workout-plans");
    await expect(page.getByText("Workout Plans")).toBeVisible();
    await expect(page.getByRole("link", { name: /Generate with AI/i })).toBeVisible();
  });

  test("diet plans page loads and offers AI generation", async ({ page }) => {
    await page.goto("/diet-plans");
    await expect(page.getByText("Diet Plans")).toBeVisible();
    await expect(page.getByRole("link", { name: /Generate with AI/i })).toBeVisible();
  });

  test("AI coach page loads and accepts a message", async ({ page }) => {
    await page.goto("/ai-coach");
    await expect(page.getByRole("heading", { name: "AI Coach" })).toBeVisible();
    await expect(page.getByPlaceholder("Type your question...")).toBeVisible();
  });

  test("membership page shows plans and payment history section", async ({ page }) => {
    await page.goto("/membership");
    await expect(page.getByRole("heading", { name: "Membership" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payment history" })).toBeVisible();
  });

  test("settings page shows the profile form and push notification toggle", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.getByPlaceholder("Gym name")).toBeVisible();
  });

  test("progress page shows weight trend and progress photos sections", async ({ page }) => {
    await page.goto("/progress");
    await expect(page.getByText("Weight trend")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Progress photos" })).toBeVisible();
  });

  test("logging out returns to a logged-out state", async ({ page }) => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: /Log out/i }).click();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
