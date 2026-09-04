/**
 * The committed aria snapshot of a populated `/time` week.
 *
 * Admin-only not because the route is, but because the snapshot is fixture data: the dev seed
 * gives every member a different set of entries — different projects, descriptions and daily
 * totals — so a single committed baseline can only ever describe one role's week. The structural
 * contract that does hold for every role is asserted in ../time.spec.ts, which both role projects
 * run.
 *
 * `snapshotPathTemplate` keys baselines on the spec file name, so this file owns
 * e2e/__aria__/time-week.spec.ts/. Date-derived values are matched with regexes rather than
 * literals — read the diff before ever regenerating it.
 */
import { expect, test, visit } from "../../fixtures";

test("matches the committed aria snapshot of a populated week", async ({ page }) => {
  await visit(page, "/time");

  await expect(page.getByRole("main")).toMatchAriaSnapshot({
    name: "time-week-populated.aria.yml",
  });
});
