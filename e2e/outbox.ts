/**
 * Single source of truth for the e2e file outbox path: `playwright.config.ts` hands it to the
 * server under test, and `auth.setup.ts` reads the delivered links back out of it.
 */
export const E2E_OUTBOX_PATH = ".mail/e2e-outbox.jsonl";

// Kept in step with the `dev:e2e` script in package.json, which cannot import this file.
