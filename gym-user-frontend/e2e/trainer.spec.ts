import { test, expect } from "@playwright/test";
import { assignTrainer, createVerifiedUser, deleteTrainerAndTrainee, uniqueTestEmail } from "./helpers";

test.describe("Trainer panel", () => {
  const trainerEmail = uniqueTestEmail("coach");
  const traineeEmail = uniqueTestEmail("trainee");
  const password = "CoachPass123";

  test.beforeAll(async () => {
    await createVerifiedUser(trainerEmail, password, "E2E Coach");
    await createVerifiedUser(traineeEmail, password, "E2E Trainee");
    await assignTrainer(trainerEmail, traineeEmail);
  });

  test.afterAll(async () => {
    await deleteTrainerAndTrainee(trainerEmail, traineeEmail);
  });

  test("coach sees the trainee, reviews tabs and keeps a private note", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or mobile number").fill(trainerEmail);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator("form").getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/trainer");
    await expect(page.getByRole("heading", { name: /My Trainees/ })).toBeVisible();
    // A brand-new member has no visits, workouts or membership yet.
    await expect(page.getByText("No workouts this week")).toBeVisible();
    await page.getByRole("link", { name: "E2E Trainee" }).click();

    await expect(page.getByRole("heading", { name: "E2E Trainee" })).toBeVisible();
    await expect(page.getByText(/No medical conditions or allergies on file/)).toBeVisible();

    await page.getByRole("tab", { name: "Private notes" }).click();
    await page.getByLabel("Add a note").fill("Prefers morning sessions. Watch left knee on lunges.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Prefers morning sessions. Watch left knee on lunges.")).toBeVisible();

    await page.getByRole("button", { name: "Edit note" }).click();
    await page.getByLabel("Edit note").fill("Prefers morning sessions.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/· edited/)).toBeVisible();

    await page.getByRole("tab", { name: "Plans & messages" }).click();
    await expect(page.getByRole("heading", { name: "Message the member" })).toBeVisible();
  });

  test("members can't open the trainer area", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or mobile number").fill(traineeEmail);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator("form").getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/trainer");
    await expect(page.getByText(/This section is for King's Fitness coaches/)).toBeVisible();
  });
});
