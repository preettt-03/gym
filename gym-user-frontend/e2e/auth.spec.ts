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
    await page.getByLabel("Email or mobile number").fill(email);
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
    await page.getByLabel("Email or mobile number").fill(email);
    await page.getByPlaceholder("Password").fill("WrongPassword123");
    await page.locator("form").getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText(/Incorrect password\. 2 attempts left/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("says when no account exists for the email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or mobile number").fill(uniqueTestEmail("nobody"));
    await page.getByPlaceholder("Password").fill(password);
    await page.locator("form").getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("No user found with this account.")).toBeVisible();
  });

  test("locks the form after three failed attempts with different emails, even across a reload", async ({ page }) => {
    await page.goto("/login");
    const submit = page.locator("form").getByRole("button", { name: "Log in" });
    for (let i = 0; i < 3; i++) {
      await page.getByLabel("Email or mobile number").fill(uniqueTestEmail(`nobody-${i}`));
      await page.getByPlaceholder("Password").fill(password);
      await submit.click();
      if (i < 2) await expect(page.getByText("No user found with this account.")).toBeVisible();
    }

    await expect(page.getByText(/Too many failed attempts\. Try again in \d+ seconds?/)).toBeVisible();
    await page.reload();
    await expect(page.locator("form").getByRole("button", { name: /Try again in \d+s/ })).toBeDisabled();
  });

  test("logs in with the correct password and reaches the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or mobile number").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator("form").getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("resets a forgotten password and logs in with the new one", async ({ page }) => {
    const newPassword = "FreshPassword456";

    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset code" }).click();

    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();

    await page.getByPlaceholder("000000").fill(await getLatestOtp(email));
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill("SomethingElse999");
    await page.getByLabel("Confirm new password").blur();
    await expect(page.getByText("Passwords don't match")).toBeVisible();

    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();

    await expect(page).toHaveURL(/\/login\?reset=1/);
    await expect(page.getByText("Password updated")).toBeVisible();

    await page.getByLabel("Email or mobile number").fill(email);
    await page.getByPlaceholder("Password").fill(newPassword);
    await page.locator("form").getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("redirects an unauthenticated visitor away from a protected page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  // Runs last: it leaves this account locked for 30 seconds.
  test("locks login for 30 seconds after three wrong passwords", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or mobile number").fill(email);
    const submit = page.locator("form").getByRole("button", { name: "Log in" });
    for (const left of [/2 attempts left/, /1 attempt left/]) {
      await page.getByPlaceholder("Password").fill("WrongPassword123");
      await submit.click();
      await expect(page.getByText(left)).toBeVisible();
    }
    await page.getByPlaceholder("Password").fill("WrongPassword123");
    await submit.click();

    await expect(page.getByText(/Too many failed attempts\. Try again in \d+ seconds?/)).toBeVisible();
    await expect(page.locator("form").getByRole("button", { name: /Try again in \d+s/ })).toBeDisabled();
  });
});
