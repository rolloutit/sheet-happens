/**
 * The one fact about the dev seed that specs are allowed to lean on.
 *
 * Everything else the seed produces is a deterministic function of the day it ran: the generator
 * fills days only up to that day, so the current week holds one day of data on a Monday and five on
 * a Friday, and its per-member PRNG stream re-aligns whenever the twelve-month window slides into a
 * new month. Nothing built on that can be asserted literally.
 *
 * The frozen week is the exception, and exists for this purpose. `scripts/dev-seed.mjs` plants a
 * fixed set of entries on fixed dates outside that window, for the two roles this suite signs in
 * as — so a committed aria snapshot describes the application rather than the calendar.
 *
 * Kept in step with `FROZEN_WEEK_START` in scripts/dev-seed.mjs, which TypeScript cannot import
 * (`allowJs` is off). If the two ever disagree the frozen week renders empty, which fails loudly.
 */
export const FROZEN_WEEK_START = "2025-03-03";

/** `/time` showing the frozen week rather than whatever week it is today. */
export const FROZEN_WEEK_PATH = `/time?week=${FROZEN_WEEK_START}`;
