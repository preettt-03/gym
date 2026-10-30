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
    await page.getByRole("button", { name: "Add exercise" }).first().click();
    const dialog = page.getByRole("dialog");
    const difficulty = dialog.getByRole("combobox", { name: "Difficulty" });
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

    // Escape closes only the menu, not the dialog around it.
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(difficulty).toHaveText("Intermediate");
  });

  test("creates an exercise with muscles, steps and a thumbnail, then edits and deletes it", async ({ page }) => {
    const name = `E2E Curl ${Date.now()}`;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await page.goto("/exercises");
    await page.getByRole("button", { name: "Add exercise" }).first().click();
    const dialog = page.getByRole("dialog");

    // Required fields are checked before anything is sent.
    await dialog.getByRole("button", { name: "Save exercise" }).click();
    await expect(dialog.getByText("Name is required")).toBeVisible();
    await expect(dialog.getByText("Pick the primary muscle")).toBeVisible();

    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("combobox", { name: "Primary target muscle" }).click();
    await page.getByRole("combobox", { name: "Search options" }).fill("bice");
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("combobox", { name: "Primary target muscle" })).toHaveText("Biceps");

    await dialog.getByLabel("Secondary muscles").fill("Forearms");
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Remove Forearms" })).toBeVisible();

    await dialog.getByLabel("Step 1", { exact: true }).fill("Stand tall with dumbbells at your sides");
    await page.keyboard.press("Enter");
    await dialog.getByLabel("Step 2", { exact: true }).fill("Curl up without swinging");
    await dialog.getByLabel("Mistake 1", { exact: true }).fill("Swinging the hips");
    await dialog.getByLabel("Coach's tip").fill("Squeeze hard at the top.");
    // Two photos in one drop; pin the second as the card thumbnail and caption it.
    await dialog.locator("#ex-photos").setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: png },
      { name: "b.png", mimeType: "image/png", buffer: png },
    ]);
    await expect(dialog.getByRole("button", { name: "Delete photo 2" })).toBeVisible();
    await dialog.getByRole("button", { name: "Set photo 2 as card thumbnail" }).click();
    await expect(dialog.getByRole("button", { name: "Photo 2 is the card thumbnail" })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByLabel("Caption for photo 2").fill("Top of the rep");

    // A YouTube link, labelled as an angle; a non-YouTube link is refused.
    await dialog.getByLabel("YouTube or Vimeo link").fill("https://example.com/video.mp4");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/Paste a full YouTube or Vimeo video link/)).toBeVisible();
    await dialog.getByLabel("YouTube or Vimeo link").fill("https://youtu.be/dQw4w9WgXcQ");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.getByLabel("Label for video 1").fill("Front view");

    await dialog.getByRole("button", { name: "Save exercise" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByLabel("Search exercises").fill(name);
    const card = page.locator("article", { hasText: name });
    await expect(card).toHaveCount(1);
    await expect(card.getByText("Biceps")).toBeVisible();
    await expect(card.getByText("Forearms")).toBeVisible();
    await expect(card.getByText("1 video")).toBeVisible();

    await card.getByRole("button", { name: `Edit ${name}` }).click();
    await expect(dialog.getByLabel("Step 2", { exact: true })).toHaveValue("Curl up without swinging");
    await expect(dialog.getByLabel("Caption for photo 2")).toHaveValue("Top of the rep");
    await expect(dialog.getByLabel("Label for video 1")).toHaveValue("Front view");
    // Reorder: photo 2 (the thumbnail) moves to the front and stays the thumbnail.
    await dialog.getByRole("button", { name: "Move photo 2 earlier" }).click();
    await expect(dialog.getByRole("button", { name: "Photo 1 is the card thumbnail" })).toBeVisible();
    await dialog.getByRole("button", { name: "Remove step 1" }).click();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toHaveCount(0);

    await card.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(card).toHaveCount(0);
  });

  test("tools manager hides a calculator from members and brings it back", async ({ page, request }) => {
    await page.goto("/tools");
    const toggle = page.getByRole("switch", { name: "Show BMI Calculator to members" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText(/BMI Calculator is now hidden/)).toBeVisible();
    const hidden = await request.get("http://localhost:8004/api/v1/tools");
    expect((await hidden.json()).tools.map((t: { slug: string }) => t.slug)).not.toContain("bmi");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    const shown = await request.get("http://localhost:8004/api/v1/tools");
    expect((await shown.json()).tools.map((t: { slug: string }) => t.slug)).toContain("bmi");
  });

  test("tools manager reorders with the arrows", async ({ page }) => {
    await page.goto("/tools");
    const rows = page.locator("li[draggable]");
    const first = (await rows.nth(0).locator("p").first().innerText()).trim();
    await page.getByRole("button", { name: `Move ${first} down` }).click();
    await expect(rows.nth(1).locator("p").first()).toHaveText(first);
    // Put it back.
    await page.getByRole("button", { name: `Move ${first} up` }).click();
    await expect(rows.nth(0).locator("p").first()).toHaveText(first);
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
