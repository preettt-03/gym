import { test, expect } from "@playwright/test";
import { deleteTestUser, getLatestOtp, uniqueTestEmail } from "./helpers";

test.describe("Registration and login", () => {
  const email = uniqueTestEmail("auth");
  const password = "SuperSecret123";

  test.afterAll(async () => {
    await deleteTestUser(email);
  });

  test("registers, verifies email via OTP, and reaches the dashboard", async ({ page }) => {
    await page.goto("/register");
    await page.getByPlaceholder("Full name").fill("E2E Tester");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/verify-email/);
    await expect(page.getByText("Verify your email")).toBeVisible();

    const code = await getLatestOtp(email);
    await page.getByPlaceholder("000000").fill(code);
    await page.getByRole("button", { name: "Verify email" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Welcome back/)).toBeVisible();
  });

  test("rejects login with a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill("WrongPassword123");
    await page.locator("form").getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText(/Invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in with the correct password and reaches the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator("form").getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("redirects an unauthenticated visitor away from a protected page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
