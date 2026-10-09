/**
 * Leave, from both of the admin's seats: the seeded admin is also an employee, so one storage
 * state can record leave on /leave and then bookkeep it on /admin/leave.
 *
 * Literal assertions only touch the frozen leave (`FROZEN_LEAVES` in scripts/dev-seed-leave.mjs),
 * which sits in March 2025 beside the frozen week. The seed's relative leave moves with the month
 * it runs in, so nothing here names it.
 *
 * The round trip creates one leave and deletes it again, so a green run leaves the database as it
 * found it. It picks a Wednesday two months out: past the current month, where a failed earlier
 * run is the only thing that could already be there.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, test, visit } from "../../fixtures";

test.describe.configure({ mode: "serial" });

const FROZEN_MONTH = "2025-03";

test("lists the frozen leave in the employee's own history", async ({ page }) => {
  await visit(page, "/leave?view=list");

  const earlier = page.getByRole("region", { name: "Earlier" });
  const frozen = earlier.getByRole("button", { name: /Mar 12 – 14, 2025/ });
  await expect(frozen).toContainText("3 workdays");
  await expect(frozen).toContainText("Family trip");
  await expect(frozen).toContainText("Vacation");
});

test("shows a colleague as away without the reason", async ({ page }) => {
  await visit(page, `/leave?month=${FROZEN_MONTH}`);

  const calendar = page.getByRole("region", { name: /Leave calendar, March 2025/ });
  const week = calendar.getByRole("listitem", { name: "Week 11" });
  await expect(
    week.getByRole("button", { name: /^Dóra Kovács, Away, Mar 11, 2025, Morning/ }),
  ).toBeVisible();
  await expect(
    week.getByRole("button", { name: /^You, Vacation, Mar 12 – 14, 2025/ }),
  ).toBeVisible();
  // The note and the kind of a colleague's leave never reach this page.
  await expect(page.getByText("Doctor's appointment")).toHaveCount(0);
  await expect(calendar.getByText("Sick leave")).toHaveCount(0);
});

test("matches the committed aria snapshot of the frozen month", async ({ page }) => {
  await visit(page, `/leave?month=${FROZEN_MONTH}`);

  await expect(
    page.getByRole("region", { name: /Leave calendar, March 2025/ }),
  ).toMatchAriaSnapshot({
    name: "leave-frozen-month.aria.yml",
  });
});

test("records a half day, ticks it as processed and deletes it", async ({ page }) => {
  // Three cold pages in a row on a dev server; see time.spec.ts for why the budget is generous.
  test.setTimeout(90_000);
  const target = wednesdayTwoMonthsOut();
  const dayName = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(target);
  const month = target.toISOString().slice(0, 7);
  const rangeLabel = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(target);
  const row = page.getByRole("row", {
    name: new RegExp(`Admin User.*${escapeRegExp(rangeLabel)}`),
  });

  // A run that failed half way leaves its leave behind, and the next one would hit the overlap
  // rule. Clear it first, through the same admin delete the test ends with.
  await visit(page, `/admin/leave?month=${month}`);
  for (let remaining = await row.count(); remaining > 0; remaining -= 1) {
    await deleteLeave(page, row.first());
    // Wait for the refreshed list, or the next pass would open the row just deleted.
    await expect(row).toHaveCount(remaining - 1);
  }

  await visit(page, "/leave?new=leave");
  const drawer = page.getByRole("dialog", { name: "Add leave" });
  // Each first click after a navigation can land before React hydrates and do nothing, so it is
  // retried until its effect shows, the pattern time.spec.ts uses. Opening a picker is idempotent.
  await expect(async () => {
    await drawer.getByRole("button", { name: /^Dates/ }).click();
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: "Next month" }).click();
  await page.getByRole("button", { name: dayName }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await drawer.getByText("Morning", { exact: true }).click();
  await expect(drawer.getByText("0.5 workdays")).toBeVisible();
  await drawer.getByRole("button", { name: "Add leave" }).click();
  await expect(page.getByText("Leave added.")).toBeVisible();

  await visit(page, `/admin/leave?month=${month}`);
  const hr = page.getByRole("checkbox", {
    name: `Admin User (${rangeLabel}) processed`,
  });
  // `check` clicks only while the box is unticked, so retrying it cannot untick it again.
  await expect(async () => {
    await hr.check({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByText("1 leave marked as processed.")).toBeVisible();
  await expect(hr).toBeChecked();

  await deleteLeave(page, row);
  await expect(hr).toHaveCount(0);
});

async function deleteLeave(page: Page, row: Locator) {
  await expect(async () => {
    await row.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByText("Leave deleted.").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** The first Wednesday of the month after next, at UTC midnight. */
function wednesdayTwoMonthsOut() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 2, 1));
  while (date.getUTCDay() !== 3) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const path of ["/leave", "/leave?view=list", "/admin/leave", "/admin/leave?view=calendar"]) {
  test(
    `${path} has no WCAG 2.2 AA violations`,
    { tag: "@a11y" },
    async ({ page, makeAxeBuilder }, testInfo) => {
      await visit(page, path);
      await expect(page.getByRole("heading", { level: 1, name: "Leave" })).toBeVisible();
      const results = await makeAxeBuilder().analyze();

      await testInfo.attach("axe-results.json", {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });

      expect(results.violations).toEqual([]);
    },
  );
}
