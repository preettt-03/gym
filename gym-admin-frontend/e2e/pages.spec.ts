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

  test("dashboard analytics switch date range and expose chart data", async ({ page }) => {
    const sevenDays = page.getByRole("button", { name: "7 days" });
    await expect(page.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");

    await sevenDays.click();
    await expect(sevenDays).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("vs previous 7 days").first()).toBeVisible();

    // Every chart has a table twin; the revenue table lists one row per day.
    await page.getByText("View data").first().click();
    await expect(page.locator("details[open] tbody tr")).toHaveCount(7);
    await expect(page.getByRole("img", { name: /Revenue by day/ })).toBeVisible();
  });

  test("foods: validates, adds, edits and removes a food", async ({ page }) => {
    const name = `E2E Paneer ${Date.now()}`;
    await page.getByRole("link", { name: "Foods" }).click();
    await expect(page.getByRole("heading", { name: "Foods" })).toBeVisible();

    await page.getByRole("button", { name: "Add food" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add food" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Calories").fill("265");
    await dialog.getByLabel("Protein").fill("60");
    await dialog.getByLabel("Carbs").fill("30");
    await dialog.getByLabel("Fat", { exact: true }).fill("20");
    await dialog.getByRole("button", { name: "Add food" }).click();
    await expect(dialog.getByText("Protein, carbs and fat together cannot exceed 100 g")).toBeVisible();

    await dialog.getByLabel("Protein").fill("18");
    await dialog.getByLabel("Carbs").fill("3.6");
    await dialog.getByRole("button", { name: "Add food" }).click();
    await expect(page.getByText(`Added ${name}`)).toBeVisible();

    await page.getByLabel("Search foods").fill(name);
    await page.getByRole("button", { name: `Edit ${name}` }).first().click();
    const edit = page.getByRole("dialog", { name: "Edit food" });
    await edit.getByLabel("Calories").fill("270");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`Updated ${name}`)).toBeVisible();

    await page.getByRole("button", { name: `Remove ${name}` }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove food" }).click();
    await expect(page.getByText(`Removed ${name}`)).toBeVisible();
    await expect(page.getByText(/No foods match/)).toBeVisible();
  });

  test("categories: adds and deletes an exercise category", async ({ page }) => {
    const name = `E2E Mobility ${Date.now()}`;
    await page.getByRole("link", { name: "Categories" }).click();
    await page.getByRole("button", { name: "Add exercise category" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add category" }).click();
    await expect(dialog.getByText("Name is required")).toBeVisible();

    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText(`Added ${name}`)).toBeVisible();

    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete category" }).click();
    await expect(page.getByText(`Deleted ${name}`)).toBeVisible();
  });

  test("users: filter by role and open the detail page", async ({ page }) => {
    await page.getByRole("link", { name: "Users" }).click();
    await page.getByRole("group", { name: "Filter by role" }).getByRole("button", { name: /Admins/ }).click();
    const main = page.getByRole("main");
    await expect(main.getByText("admin@gym.local")).toBeVisible();

    await page.getByRole("link", { name: "Manage admin@gym.local" }).click();
    await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Platform Admin" })).toBeVisible();
    await expect(page.getByText("Gym visits (30 days)")).toBeVisible();
    // Admins can't change their own access from the detail page.
    await expect(page.getByText(/This is your account/)).toBeVisible();
    await expect(page.getByLabel("Role")).toHaveCount(0);
  });

  test("users page loads the user list", async ({ page }) => {
    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL(/\/users/);
    await expect(page.getByRole("main").getByText(/admin@gym\.local/)).toBeVisible();
  });

  test("exercises page loads", async ({ page }) => {
    await page.getByRole("link", { name: "Exercises" }).click();
    await expect(page).toHaveURL(/\/exercises/);
  });

  test("themed dropdowns open, pick with mouse and keyboard, and close on Escape", async ({ page }) => {
    await page.goto("/exercises");
    const difficulty = page.getByRole("combobox", { name: "Difficulty" });
    await expect(difficulty).toHaveText("Beginner");

    await difficulty.click();
    const list = page.getByRole("listbox");
    await expect(list.getByRole("option")).toHaveCount(3);
    await expect(list.getByRole("option", { name: "Beginner" })).toHaveAttribute("aria-selected", "true");
    await list.getByRole("option", { name: "Advanced" }).click();
    await expect(list).toHaveCount(0);
    await expect(difficulty).toHaveText("Advanced");
    await expect(difficulty).toBeFocused();

    // Keyboard: open, move up one, choose.
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(difficulty).toHaveText("Intermediate");

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(difficulty).toHaveText("Intermediate");
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
