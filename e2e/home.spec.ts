import { expect, test } from "@playwright/test";

test("renders the frontend foundation page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /frontend foundation/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /primary action/i })).toBeVisible();
});
