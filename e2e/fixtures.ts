/**
 * Shared fixtures for authenticated specs: a pinned clock, a pinned UI locale, and one axe
 * scanner built the same way everywhere.
 *
 * Invariants this file exists to hold:
 *  - the accessibility tree is only a stable contract if time and locale are stable, so both are
 *    pinned here rather than per spec;
 *  - every axe scan uses the same tag set, so a clean run means the same thing in every spec.
 */
import AxeBuilder from "@axe-core/playwright";
import { test as base, type Page } from "@playwright/test";

/**
 * WCAG 2.2 Level AA, passed through `withTags` only.
 *
 * Per the @axe-core/playwright README, `withTags`, `withRules` and `options` all overwrite each
 * other, so chaining any two of them silently discards the earlier call — including the
 * `options({ rules: ... })` form needed to switch on a rule that is off by default. `disableRules`
 * is the one that composes, being overridden only by `options` or a later `disableRules`. So: add
 * tags here, and if a default-off rule is ever needed, it has to be folded into a single
 * `options()` call that restates these tags rather than added alongside them.
 */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * The app renders in the locale from this cookie, so weekday names, headings and every accessible
 * name in a committed aria snapshot depend on it. Pinned to `en` because the snapshots are stored
 * in one language; Hungarian coverage comes from the axe scan plus the catalogue parity test in
 * src/i18n/messages.test.ts.
 */
const UI_LOCALE = "en";

/**
 * 09:00 on the day the suite runs. The dev seed builds its time entries relative to its own run
 * date, so the date has to stay "today" for the seeded week to be the visible week; pinning only
 * the time of day removes clock-tick churn without desynchronising from the fixture data.
 * Anything genuinely date-derived (a week range, a month label) must therefore be matched with a
 * regex in the snapshot rather than a literal.
 */
function pinnedInstant() {
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  return today;
}

export const test = base.extend<{ makeAxeBuilder: () => AxeBuilder }>({
  page: async ({ page, context, baseURL }, run) => {
    await context.addCookies([
      { name: "sheet-happens-locale", value: UI_LOCALE, url: baseURL ?? "http://localhost:3000" },
    ]);
    await page.clock.setFixedTime(pinnedInstant());
    await run(page);
  },

  makeAxeBuilder: async ({ page }: { page: Page }, run) => {
    await run(() => new AxeBuilder({ page }).withTags(WCAG_22_AA));
  },
});

/**
 * Navigates without waiting for the `load` event.
 *
 * Under several parallel workers the Turbopack dev server leaves chunk and HMR requests hanging,
 * so `load` can never fire even though the page has rendered — the failure looks like a 30s
 * navigation timeout against a screenshot of a perfectly good page. `domcontentloaded` plus
 * Playwright's retrying assertions is both faster and the honest signal.
 */
export async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

export { expect } from "@playwright/test";
