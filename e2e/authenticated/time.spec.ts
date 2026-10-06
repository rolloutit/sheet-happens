/**
 * Exemplar route. `/time` is the densest accessibility surface in the app — a week of per-day
 * regions, each holding a list of entries with their own edit and delete controls — so it is the
 * pattern every other route should be measured against.
 *
 * What these specs pin down:
 *  - the week is readable as text: landmarks, one `h1`, one named region per weekday;
 *  - entry controls are addressable *within a day*, because the same entry description repeats
 *    across days and a page-wide locator would resolve to several elements;
 *  - the view — scope, lens, selected day — is visible in the accessibility tree, not only on
 *    screen: a `radiogroup` named View, a second one named Week layout, a period label that says
 *    the unit, and in the Day scope a ribbon with exactly one pressed chip.
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
    // Every day can be logged into, including the empty ones — the control is structure, not a
    // consequence of the day happening to hold entries. The one exception is a day inside a
    // submitted month, which hides the control and says why with a lock in its header instead.
    // Locked cards carry the same glyph, so the check is on the header alone.
    await expect(
      region
        .getByRole("button", { name: `Add entry on ${day}` })
        .or(
          region
            .getByRole("heading", { level: 2 })
            .getByRole("img", { name: "Locked by a submitted timesheet" }),
        ),
    ).toBeVisible();
    // The column header is the way into the day: a button naming the day and its date.
    await expect(
      region.getByRole("button", { name: new RegExp(`^Open ${day}, \\d+$`) }),
    ).toBeVisible();
  }
});

test("names the view as two radiogroups and the period with its unit", async ({ page }) => {
  const view = page.getByRole("radiogroup", { name: "View" });
  await expect(view.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
  await expect(view.getByRole("radio")).toHaveCount(3);

  const layout = page.getByRole("radiogroup", { name: "Week layout" });
  await expect(layout.getByRole("radio", { name: "Agenda" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // The header is the unit: a week label between arrows that name the week as their step.
  await expect(page.getByRole("button", { name: /^Week \d+ · .+\d{4}$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out to Month" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in to Day" })).toBeVisible();
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
      // Continue starts a timer with the card's project and description; it is always in the
      // tree even though a pointer only sees it on hover.
      await expect(entry.getByRole("button", { name: /^Continue / })).toHaveCount(1);
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

test("opens a day from its header and shows the week as a ribbon with one pressed chip", async ({
  page,
}) => {
  /**
   * Generous, because two slow things stack here. The view lives in the URL
   * (`app/time/use-time-view.ts`), so this asserts a navigation, and `/time` is `force-dynamic` —
   * on a dev server whose caches are still cold, with five workers compiling at once, the first
   * render can take well over the 15s this used to allow.
   */
  test.setTimeout(90_000);

  const header = page.getByRole("button", { name: /^Open Wednesday, \d+$/ });

  // The button is in the DOM before React hydrates, so a click can land on markup that has no
  // handler yet and silently do nothing. Retrying the click-and-assert pair is the honest wait:
  // opening a day is idempotent, so a repeat is safe.
  await expect(async () => {
    await header.click();
    await expect(
      page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name: "Day" }),
    ).toHaveAttribute("aria-checked", "true");
  }).toPass({ timeout: 60_000 });

  // The ribbon exists in the Day scope and nowhere on the desktop week: the week headers were it.
  const ribbon = page.getByRole("group", { name: "Days of this week" });
  await expect(ribbon.getByRole("button", { name: "Select Wednesday" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(ribbon.getByRole("button", { pressed: true })).toHaveCount(1);

  // The header follows the scope: a day label between arrows that step a day.
  await expect(page.getByRole("button", { name: /^\w+, \w+ \d+, \d{4}$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible();

  // Selecting another chip keeps the scope and moves the selection.
  const friday = ribbon.getByRole("button", { name: "Select Friday" });
  await expect(async () => {
    await friday.click();
    await expect(friday).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 60_000 });
  await expect(ribbon.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(
    page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name: "Day" }),
  ).toHaveAttribute("aria-checked", "true");
});

test("keeps the day strip off the desktop week", async ({ page }) => {
  await expect(page.getByRole("group", { name: "Days of this week" })).toHaveCount(0);
});

test("has no WCAG 2.2 AA violations", { tag: "@a11y" }, async ({ makeAxeBuilder }, testInfo) => {
  const results = await makeAxeBuilder().analyze();

  // Attached so a failure is diagnosable from the report without re-running the suite.
  await testInfo.attach("axe-results.json", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  expect(results.violations).toEqual([]);
});
