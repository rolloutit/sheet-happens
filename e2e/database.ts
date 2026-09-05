/**
 * The database the e2e suite runs against, which is deliberately not the one a developer browses.
 *
 * Two things depend on that separation. The suite writes: onboarding the member role flips
 * `members.status` and `members.auth_user_id`, and it spends the per-IP magic-link budget that
 * lives in `rateLimit`. And the committed aria baseline is only trustworthy if nothing edits its
 * fixture by hand — `scripts/dev-seed.mjs` plants a frozen week for exactly that, and a shared
 * database would leave it one stray click away from drifting.
 *
 * `playwright.config.ts` hands this to the server it starts. A server started by `pnpm dev:e2e`
 * instead gets it from `node scripts/dev-db.mjs test-url`, because `webServer.env` applies only
 * when Playwright starts the server itself and is ignored when it reuses one.
 *
 * Create or refresh it with `pnpm db:test` (idempotent) or `pnpm db:test:reset` (pristine).
 */

/** Kept in step with `E2E_DATABASE_NAME` in scripts/dev-db.mjs, which TypeScript cannot import. */
const E2E_DATABASE_NAME = "sheet_happens_e2e";

/** Matches `defaultDatabaseUrl` in scripts/dev-db.mjs. Only used when nothing sets DATABASE_URL. */
const DEFAULT_DEV_DATABASE_URL =
  "postgresql://sheet_happens:sheet_happens@localhost:5432/sheet_happens?schema=public";

/**
 * The dev database URL with the database name swapped, so host, port and credentials are never
 * stated twice. CI sets `DATABASE_URL` to its service container; locally nothing sets it in this
 * process — `.env.local` is read by Next, not by Playwright — so the default above applies.
 */
export function e2eDatabaseUrl(databaseUrl = process.env.DATABASE_URL || DEFAULT_DEV_DATABASE_URL) {
  const url = new URL(databaseUrl);
  url.pathname = `/${E2E_DATABASE_NAME}`;
  return url.toString();
}
