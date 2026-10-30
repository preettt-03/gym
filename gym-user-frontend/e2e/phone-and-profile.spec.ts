import { test, expect } from "@playwright/test";
import { createVerifiedUser, deleteTestUser, deleteUserByPhone, randomIndianMobile, uniqueTestEmail } from "./helpers";

test.describe("Mobile number sign-up and login", () => {
  const mobile = randomIndianMobile();
  const e164 = `+91${mobile}`;

  test.afterAll(async () => {
    await deleteUserByPhone(e164);
  });

  test("signs up with a mobile number and password, then logs in with either", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Phone Member");
    await page.getByLabel("Email or mobile number").fill(mobile);
    await page.getByPlaceholder("Password").fill("MobilePass123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/We sent a 6-digit code by SMS/)).toBeVisible();

    await page.getByLabel("Verification code").fill("000000");
    await page.getByRole("button", { name: "Verify & create account" }).click();
    await expect(page.getByText(/Wrong code\. 4 attempts left/)).toBeVisible();

    // Test mode (no SMS provider yet) shows the code on screen.
    await expect(page.getByText("Test mode")).toBeVisible();
    await page.getByRole("button", { name: "Use this code" }).click();
    await page.getByRole("button", { name: "Verify & create account" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(e164)).toBeVisible();

    // Mobile number + password, from the same box an email would go in.
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: /Log out/i }).click();
    await page.goto("/login");
    await page.getByLabel("Email or mobile number").fill(`+91 ${mobile}`);
    await page.getByPlaceholder("Password").fill("MobilePass123");
    await page.locator("form").getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // …or with a one-time code instead of the password.
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: /Log out/i }).click();
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in with a one-time code instead" }).click();
    await expect(page.getByPlaceholder("Password")).toHaveCount(0);
    await page.getByLabel("Email or mobile number").fill(mobile);
    await page.getByRole("button", { name: "Send login code" }).click();
    await page.getByRole("button", { name: "Use this code" }).click();
    await page.getByRole("button", { name: "Verify & log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("tells you when no account uses the number", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or mobile number").fill(randomIndianMobile());
    await page.getByPlaceholder("Password").fill("Whatever123");
    await page.locator("form").getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("No user found with this account.")).toBeVisible();
  });
});

test.describe("Profile details", () => {
  const email = uniqueTestEmail("profile");
  const password = "SuperSecret123";

  test.beforeAll(async () => {
    await createVerifiedUser(email, password, "Profile Tester");
  });
  test.afterAll(async () => {
    await deleteTestUser(email);
  });

  test("saves date of birth, blood group, address and health details", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or mobile number").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator("form").getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/dashboard/);

    await page.goto("/settings");
    await page.getByLabel("Date of birth").fill("1998-05-20");
    await expect(page.getByText(/Age \d+ — updates automatically/)).toBeVisible();
    await page.getByRole("combobox", { name: "Blood group" }).click();
    await page.getByRole("option", { name: "B+", exact: true }).click();
    await page.getByLabel("Alternate mobile").fill("98765 00001");
    await page.getByLabel("House / flat, street").fill("12, MG Road");
    await page.getByLabel("City / town").fill("Indore");
    await page.getByLabel("State").fill("Madhya Pradesh");
    await page.getByLabel("PIN code").fill("452001");
    await page.getByLabel("Injuries / health issues").fill("Left knee pain");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Asthma" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("City / town")).toHaveValue("Indore");
    await expect(page.getByLabel("Alternate mobile")).toHaveValue("+919876500001");
    await expect(page.getByRole("combobox", { name: "Blood group" })).toHaveText("B+");
    await expect(page.getByRole("button", { name: "Remove Left knee pain" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Asthma" })).toBeVisible();
  });
});
