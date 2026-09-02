import { expect, test } from "@playwright/test";

test("sends an anonymous visitor from the root to the login screen", async ({ page }) => {
  await page.goto("/");

  // `app/page.tsx` has no markup of its own — it only routes on app-access state, and for an
  // anonymous visitor that is `loginRoute("/dashboard")` (src/server/auth/app-access.ts).
  await expect(page).toHaveURL(/\/login\?callbackURL=%2Fdashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
