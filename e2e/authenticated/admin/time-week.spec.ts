/**
 * The committed aria snapshot of a populated `/time` week.
 *
 * It describes the **frozen week** the dev seed plants (see ../../seed.ts), not whatever week it is
 * today. That is the whole point: the seed's ordinary generator fills days only up to the day it
 * runs and re-aligns its PRNG when its twelve-month window slides, so a snapshot of the current
 * week changes with the calendar and with the database it was captured from. The frozen week
 * changes only when the application does — which is what makes this baseline worth reviewing.
 *
 * Admin-only because the fixture is per role: the seed gives the admin and the member different
 * frozen weeks, so one committed file can only describe one of them. The structural contract that
 * holds for both is asserted in ../time.spec.ts, which both role projects run.
 *
 * `snapshotPathTemplate` keys baselines on the spec file name, so this file owns
 * e2e/__aria__/time-week.spec.ts/. Every value in it is a literal, including the dates — read the
 * diff before ever regenerating it.
 */
import { expect, test, visit } from "../../fixtures";
import { FROZEN_WEEK_PATH } from "../../seed";

test("matches the committed aria snapshot of the frozen week", async ({ page }) => {
  await visit(page, FROZEN_WEEK_PATH);

  await expect(page.getByRole("main")).toMatchAriaSnapshot({
    name: "time-week-frozen.aria.yml",
  });
});
