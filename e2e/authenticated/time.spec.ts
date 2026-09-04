/**
 * Exemplar route. `/time` is the densest accessibility surface in the app — a week of per-day
 * regions, each holding a list of entries with their own edit and delete controls — so it is the
 * pattern every other route should be measured against.
 *
 * What these specs pin down:
 *  - the week is readable as text: landmarks, one `h1`, one named region per weekday;
 *  - entry controls are addressable *within a day*, because the same entry description repeats
 *    across days and a page-wide locator would resolve to several elements;
 *  - opening a day is visible in the accessibility tree, not only on screen.
 */
import { expect, test, visit } from "../fixtures";

test.beforeEach(async ({ page }) => {
  await visit(page, "/time");
});

test("exposes the week as landmarks, one h1 and a region per weekday", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Time tracking");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();

  for (const day of [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]) {
    await expect(page.getByRole("region", { name: day })).toBeVisible();
  }
});

test("scopes entry controls to their day", async ({ page }) => {
  const monday = page.getByRole("region", { name: "Monday" });

  // Every entry in a day is a list item with a named edit and delete control. Asserting through
  // the region is the contract: the same description legitimately repeats on other days.
  const entries = monday.getByRole("listitem");
  await expect(entries.first()).toBeVisible();

  for (const entry of await entries.all()) {
    await expect(entry.getByRole("button", { name: /^Edit / })).toHaveCount(1);
    await expect(entry.getByRole("button", { name: /^Delete / })).toHaveCount(1);
  }

  await expect(monday.getByRole("button", { name: "Add entry on Monday" })).toBeVisible();
});

test("puts the selected day in the accessibility tree, not just the styling", async ({ page }) => {
  const dayPicker = page.getByRole("group", { name: "Days of this week" });
  const wednesday = dayPicker.getByRole("button", { name: "Select Wednesday" });

  await expect(wednesday).toHaveAttribute("aria-pressed", "false");

  // The button is in the DOM with its `aria-pressed` already set before React hydrates, so a
  // click can land on markup that has no handler yet and silently do nothing. Retrying the
  // click-and-assert pair is the honest wait: selecting a day is idempotent, so a repeat is safe.
  await expect(async () => {
    await wednesday.click();
    await expect(wednesday).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 15_000 });
});

test("marks exactly one day as selected", async ({ page }) => {
  // The week range, the selected day and the day total are all date-derived, so they are kept out
  // of the committed snapshot and asserted by shape here instead.
  await expect(page.getByText(/^\w+ \d+ - \w+ \d+, \d{4}$/)).toBeVisible();

  const dayPicker = page.getByRole("group", { name: "Days of this week" });
  await expect(dayPicker.getByRole("button", { pressed: true })).toHaveCount(1);
});

test("matches the committed aria snapshot of a populated week", async ({ page }) => {
  await expect(page.getByRole("main")).toMatchAriaSnapshot({
    name: "time-week-populated.aria.yml",
  });
});

test(
  "has no WCAG 2.2 AA violations",
  { tag: "@a11y" },
  async ({ page, makeAxeBuilder }, testInfo) => {
    const results = await makeAxeBuilder().analyze();

    // Attached so a failure is diagnosable from the report without re-running the suite.
    await testInfo.attach("axe-results.json", {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });

    expect(results.violations).toEqual([]);
  },
);
