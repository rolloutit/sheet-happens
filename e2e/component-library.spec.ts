import { expect, test } from "@playwright/test";

test("renders the component API audit route", async ({ page }) => {
  await page.goto("/component-library");

  await expect(page.getByRole("heading", { name: /component api audit route/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /dashboard contract/i })).toBeVisible();
  await expect(page.getByText(/9 product route contracts/i)).toBeVisible();
});

test("switches composed product surfaces from the route controls", async ({ page }) => {
  await page.goto("/component-library");

  await page.getByRole("button", { name: /^reports$/i }).click();
  await expect(page.getByRole("heading", { name: /reports contract/i })).toBeVisible();
  await expect(page.getByText(/Filters, KPI tiles, chart/i)).toBeVisible();

  await page.getByRole("button", { name: /^payslips$/i }).click();
  await expect(page.getByRole("heading", { name: /payslips contract/i })).toBeVisible();
  await expect(page.getByText(/payroll validation/i)).toBeVisible();
});

test("switches composed product surfaces from the command palette", async ({ page, isMobile }) => {
  test.skip(isMobile, "the shell command trigger is desktop-only");

  await page.goto("/component-library");

  await page.getByRole("button", { name: /ugrás bárhová/i }).click();
  await page.getByLabel(/search audit surfaces/i).fill("reports");
  await page.getByRole("option", { name: /reports/i }).click();

  await expect(page.getByRole("heading", { name: /reports contract/i })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Active audit surface: Reports");
});

test("keeps weekly grid callbacks observable in the app route", async ({ page }) => {
  await page.goto("/component-library");

  await page.getByRole("button", { name: /time grid/i }).click();
  await expect(page.getByRole("heading", { name: /time grid contract/i })).toBeVisible();

  await page
    .getByRole("button", { name: /apollo migration, monday/i })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Editing Apollo Migration on Monday");
});
