/**
 * Leave is an employee feature. The seeded member is a contractor, so for them the page must not
 * exist and the navigation must not offer it.
 */
import { expect, test, visit } from "../../fixtures";

test("keeps leave away from a contractor", async ({ page }) => {
  const response = await page.goto("/leave", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);

  await visit(page, "/dashboard");
  await expect(page.getByRole("link", { name: "Leave" })).toHaveCount(0);
});
