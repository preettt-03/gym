import { test, expect } from "@playwright/test";
import { createMember, deleteMember } from "./helpers";

const ADMIN_EMAIL = "admin@gym.local";
const ADMIN_PASSWORD = "Admin@12345";

test.describe("Member CRM page", () => {
  let member: { id: string; email: string };

  test.beforeEach(async ({ page }) => {
    member = await createMember("E2E Ravi Kumar");
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test.afterEach(async () => {
    await deleteMember(member.id);
  });

  test("runs the front-desk flow: payment, extend, check-in, tags, notes, medical, card", async ({ page }) => {
    await page.goto(`/users/${member.id}`);
    await expect(page.getByRole("heading", { name: "E2E Ravi Kumar" })).toBeVisible();
    await expect(page.getByText("No membership yet.")).toBeVisible();

    // Desk payment starts the membership. UPI needs a reference.
    await page.getByRole("button", { name: "Record payment" }).click();
    const pay = page.getByRole("dialog", { name: "Record a payment" });
    await pay.getByRole("combobox", { name: "Plan" }).click();
    await page.getByRole("option").first().click();
    await pay.getByRole("button", { name: "UPI" }).click();
    await pay.getByRole("button", { name: /^Record/ }).click();
    await expect(pay.getByText(/Add the UPI reference/)).toBeVisible();
    await pay.getByLabel(/Reference/).fill("412345678901");
    await pay.getByRole("button", { name: /^Record/ }).click();
    await expect(pay).toHaveCount(0);
    await expect(page.getByText("days left")).toBeVisible();
    await expect(page.getByText("412345678901", { exact: false })).toBeVisible();

    // Extend by a week.
    await page.getByRole("button", { name: "+7 days" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Extend" }).click();
    await expect(page.getByText("Extended by 7 days")).toBeVisible();

    // Desk check-in lands on the heatmap streak and the timeline.
    await page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(page.getByText("Checked in — visit logged")).toBeVisible();
    await expect(page.getByText("day streak")).toBeVisible();
    const timeline = page.locator("section", { has: page.getByRole("heading", { name: "Activity timeline" }) });
    await expect(timeline.getByText("Checked in", { exact: true })).toBeVisible();
    await expect(timeline.getByText("Membership extended by 7 days")).toBeVisible();

    // Tag + phone → WhatsApp link.
    await page.getByRole("button", { name: "Tag", exact: true }).click();
    await page.getByLabel("New tag").fill("VIP");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Remove tag VIP" })).toBeVisible();
    await page.getByRole("button", { name: "Add phone number" }).click();
    await page.getByLabel("Phone", { exact: true }).fill("98765 43210");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("link", { name: "WhatsApp" }).first()).toHaveAttribute("href", /wa\.me\/919876543210/);

    // Staff note.
    await page.getByLabel("New note").fill("Interested in PT package");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Interested in PT package")).toBeVisible();

    // Medical details stay hidden until asked for.
    await page.getByRole("button", { name: "Show medical details" }).click();
    await expect(page.getByText("Injuries / health issues")).toBeVisible();

    // Printable card with a QR code.
    await page.getByRole("button", { name: "Member card" }).click();
    await expect(page.getByRole("img", { name: /QR code for KF-/ })).toBeVisible();
  });

  test("freezing pauses the membership and cancelling needs a reason", async ({ page }) => {
    await page.goto(`/users/${member.id}`);
    await page.getByRole("button", { name: "Start a membership" }).click();
    const pay = page.getByRole("dialog", { name: "Record a payment" });
    await pay.getByRole("combobox", { name: "Plan" }).click();
    await page.getByRole("option").first().click();
    await pay.getByRole("button", { name: /^Record/ }).click();
    await expect(pay).toHaveCount(0);

    await page.getByRole("button", { name: "Freeze" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Freeze" }).click();
    await expect(page.getByText(/Frozen until/)).toBeVisible();
    await page.getByRole("button", { name: "Resume now" }).click();
    await expect(page.getByText("Membership resumed").first()).toBeVisible();

    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this membership?" });
    await dialog.getByRole("button", { name: "Cancel membership" }).click();
    await expect(dialog.getByText(/Give a short reason/)).toBeVisible();
    await dialog.getByLabel(/Reason/).fill("Moved to another city");
    await dialog.getByRole("button", { name: "Cancel membership" }).click();
    await expect(page.getByText("Membership cancelled").first()).toBeVisible();
  });
});
