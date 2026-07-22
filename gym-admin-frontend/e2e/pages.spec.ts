import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@gym.local";
const ADMIN_PASSWORD = "Admin@12345";

test.describe("Admin pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("dashboard shows real platform stats", async ({ page }) => {
    await expect(page.getByText("Total users")).toBeVisible();
    await expect(page.getByText("Total revenue")).toBeVisible();
  });

  test("users page loads the user list", async ({ page }) => {
    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL(/\/users/);
    await expect(page.getByText(/admin@gym\.local/)).toBeVisible();
  });

  test("exercises page loads", async ({ page }) => {
    await page.getByRole("link", { name: "Exercises" }).click();
    await expect(page).toHaveURL(/\/exercises/);
  });

  test("workout plans page loads", async ({ page }) => {
    await page.getByRole("link", { name: "Workout Plans" }).click();
    await expect(page).toHaveURL(/\/workout-plans/);
  });

  test("AI management page loads with feature toggles", async ({ page }) => {
    await page.getByRole("link", { name: "AI Management" }).click();
    await expect(page).toHaveURL(/\/ai-management/);
    await expect(page.getByText("Feature toggles")).toBeVisible();
  });

  test("audit logs page loads", async ({ page }) => {
    await page.getByRole("link", { name: "Audit Logs" }).click();
    await expect(page).toHaveURL(/\/audit-logs/);
  });

  test("logging out returns to the login page", async ({ page }) => {
    await page.getByRole("button", { name: /Log out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
