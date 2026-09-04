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
 *
 * Everything here holds for any signed-in member, so every role project runs it. The one part of
 * `/time` that cannot — the committed aria snapshot, which describes one role's frozen week —
 * lives in admin/time-week.spec.ts.
 */
import { expect, test, visit } from "../fixtures";
import { FROZEN_WEEK_PATH } from "../seed";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

test.beforeEach(async ({ page }) => {
  await visit(page, "/time");
});

test("exposes the week as landmarks, one h1 and a region per weekday", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Time tracking");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();

  for (const day of WEEKDAYS) {
    const region = page.getByRole("region", { name: day });
    await expect(region).toBeVisible();
    // Every day can be logged into, including the empty ones — the control is structure, not
    // a consequence of the day happening to hold entries.
    await expect(region.getByRole("button", { name: `Add entry on ${day}` })).toBeVisible();
  }
});

test("scopes entry controls to their day", async ({ page }) => {
  // The frozen week rather than today's, because this is the one test here that needs entries to
  // exist. The seed fills days only up to the day it runs, so on a Monday the current week can
  // legitimately hold nothing at all. Both roles get their own frozen week, so the contract is
  // asserted against each role's own data.
  await visit(page, FROZEN_WEEK_PATH);

  // Which weekdays hold entries differs per role, so the assertion follows the data rather than
  // naming a day. What it pins is the contract: a day's entries are addressable *through its
  // region*, because the same description legitimately repeats on other days.
  const counts: number[] = [];

  for (const day of WEEKDAYS) {
    const entries = page.getByRole("region", { name: day }).getByRole("listitem");
    const count = await entries.count();

    if (count === 0) continue;

    counts.push(count);

    for (const entry of await entries.all()) {
      await expect(entry.getByRole("button", { name: /^Edit / })).toHaveCount(1);
      await expect(entry.getByRole("button", { name: /^Delete / })).toHaveCount(1);
    }
  }

  expect(
    counts,
    `${FROZEN_WEEK_PATH} holds no entries at all — is the e2e database seeded? \`pnpm db:test\``,
  ).not.toEqual([]);

  // Scoping to a day only means something when a day holds more than one entry, and both frozen
  // weeks are built with such a day.
  expect(
    Math.max(...counts),
    "no day of the frozen week holds more than one entry",
  ).toBeGreaterThan(1);
});

test("puts the selected day in the accessibility tree, not just the styling", async ({ page }) => {
  /**
   * Generous, because two slow things stack here. The selected day lives in the URL
   * (`app/time/use-time-zoom.ts`), so this asserts a navigation, and `/time` is `force-dynamic` —
   * on a dev server whose caches are still cold, with five workers compiling at once, the first
   * render of a new `?day=` can take well over the 15s this used to allow. Measured warm it is
   * under a second; the failure mode was purely the cold first pass, which is every CI run.
   */
  test.setTimeout(90_000);

  const dayPicker = page.getByRole("group", { name: "Days of this week" });
  const wednesday = dayPicker.getByRole("button", { name: "Select Wednesday" });

  await expect(wednesday).toHaveAttribute("aria-pressed", "false");

  // The button is in the DOM with its `aria-pressed` already set before React hydrates, so a
  // click can land on markup that has no handler yet and silently do nothing. Retrying the
  // click-and-assert pair is the honest wait: selecting a day is idempotent, so a repeat is safe.
  await expect(async () => {
    await wednesday.click();
    await expect(wednesday).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 60_000 });
});

test("marks exactly one day as selected", async ({ page }) => {
  // The week range, the selected day and the day total are all date-derived, so they are kept out
  // of the committed snapshot and asserted by shape here instead.
  await expect(page.getByText(/^\w+ \d+ - \w+ \d+, \d{4}$/)).toBeVisible();

  const dayPicker = page.getByRole("group", { name: "Days of this week" });
  await expect(dayPicker.getByRole("button", { pressed: true })).toHaveCount(1);
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
