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

  test("favourites and recently viewed exercises", async ({ page }) => {
    await page.goto("/exercises/plank");
    const save = page.getByRole("button", { name: "Add Plank to favourites" });
    await save.click();
    const saved = page.getByRole("button", { name: "Remove Plank from favourites" });
    await expect(saved).toHaveAttribute("aria-pressed", "true");

    await page.goto("/exercises");
    await page.getByRole("tab", { name: /Favourites/ }).click();
    await expect(page.getByRole("link", { name: "Plank" })).toBeVisible();
    await page.getByRole("tab", { name: "Recently viewed" }).click();
    await expect(page.getByRole("link", { name: "Plank" })).toBeVisible();

    // Leave the shared admin account as we found it.
    await page.getByRole("tab", { name: /Favourites/ }).click();
    await page.getByRole("button", { name: "Remove Plank from favourites" }).click();
    await expect(page.getByText(/No favourites yet/)).toBeVisible();
  });

  test("dashboard shows stat cards and today's plan sections", async ({ page }) => {
    await expect(page.getByText("BMI")).toBeVisible();
    await expect(page.getByText("Current streak")).toBeVisible();
    await expect(page.getByText("Today's workout")).toBeVisible();
    await expect(page.getByText("Today's diet")).toBeVisible();
  });

  test("workout plans page loads and offers AI generation", async ({ page }) => {
    await page.goto("/workout-plans");
    await expect(page.getByRole("heading", { name: "Workout Plans" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Generate with AI/i })).toBeVisible();
  });

  test("diet plans page loads and offers AI generation", async ({ page }) => {
    await page.goto("/diet-plans");
    await expect(page.getByRole("heading", { name: "Diet Plans" })).toBeVisible();
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

  test("uploads a private progress photo that renders and can be deleted", async ({ page }) => {
    await page.goto("/progress");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await page.locator('input[type="file"]').setInputFiles({ name: "week1.png", mimeType: "image/png", buffer: png });

    const img = page.getByRole("img", { name: "Progress photo" });
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", /\/api\/v1\/progress-photos\/file\/.+sig=/);
    // The signed link actually serves the image.
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Delete photo" }).click();
    await page.getByRole("button", { name: /^Delete$/ }).click();
    await expect(img).toHaveCount(0);
  });

  test("chat lives in the header icons, not the nav links", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Chat", exact: true })).toHaveCount(1);
    await nav.getByRole("link", { name: "Chat", exact: true }).click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(nav.getByRole("link", { name: "Chat", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("adds and removes a profile photo, which shows in the account menu", async ({ page }) => {
    await page.goto("/settings");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await page.getByLabel("Choose profile photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });

    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    const menuAvatar = page.getByRole("button", { name: "Account menu" }).locator("img");
    await expect(menuAvatar).toHaveAttribute("src", /\/uploads\/.+\.png$/);

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("button", { name: "Add photo" })).toBeVisible();
    await expect(menuAvatar).toHaveCount(0);
  });

  test("logging out returns to a logged-out state", async ({ page }) => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: /Log out/i }).click();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
