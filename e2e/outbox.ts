/**
 * The e2e file outbox: `playwright.config.ts` hands the path to the server under test, and
 * `auth.setup.ts` reads the delivered links back out of it.
 *
 * Mail is the only place a usable link ever exists. A magic-link token lives hashed in
 * `verification` and an invitation token as `invitations.token_hash`, so nothing the harness could
 * query would hand it a URL — which is exactly why the setup stays on the code path a real user
 * takes instead of forging a cookie.
 */
import { readFile } from "node:fs/promises";

import { expect } from "@playwright/test";

export const E2E_OUTBOX_PATH = ".mail/e2e-outbox.jsonl";

// Kept in step with the `dev:e2e` script in package.json, which cannot import this file.

/** One line of the outbox, as written by `createFileMailer` in src/server/email/mailer.ts. */
export type OutboxEntry = {
  sentAt: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** A Better Auth magic-link sign-in URL. */
export const MAGIC_LINK = /https?:\/\/\S*?magic-link\/verify\?[^\s"'<]+/;

/**
 * An invitation acceptance URL.
 *
 * A magic link can carry `/accept-invite` inside its own `callbackURL`, but only percent-encoded,
 * so this pattern cannot pick one up by mistake.
 */
export const INVITATION_LINK = /https?:\/\/[^\s"'<]*\/accept-invite\?[^\s"'<]+/;

export async function readOutbox(): Promise<OutboxEntry[]> {
  try {
    const contents = await readFile(E2E_OUTBOX_PATH, "utf8");
    return contents
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as OutboxEntry);
  } catch {
    // The file only exists once the server has sent its first email.
    return [];
  }
}

/** Every `pattern` link addressed to `email`, oldest first. */
export function linksTo(entries: OutboxEntry[], email: string, pattern: RegExp) {
  return entries
    .filter((entry) => entry.to === email)
    .map((entry) => extractLink(entry, pattern))
    .filter((link): link is string => Boolean(link));
}

export async function countLinks(email: string, pattern: RegExp) {
  return linksTo(await readOutbox(), email, pattern).length;
}

/**
 * Waits until `email` holds more than `sentBefore` links of this shape, and returns the newest.
 *
 * Counting one shape of link, rather than reading the newest message, is what makes this usable
 * twice in a row: the outbox is appended to and never truncated, and an invited member's mailbox
 * holds both an invitation and a sign-in link — in whichever order the flow happened to produce.
 */
export async function waitForNewLink({
  email,
  pattern,
  sentBefore,
  what,
}: {
  email: string;
  pattern: RegExp;
  sentBefore: number;
  /** Named in the failure message, so a timeout says which email never arrived. */
  what: string;
}) {
  await expect
    .poll(() => countLinks(email, pattern), {
      message:
        `No new ${what} reached ${E2E_OUTBOX_PATH} for ${email}. The app under test must run ` +
        `with AUTH_EMAIL_DELIVERY_MODE=file — stop any dev server on the port and let Playwright ` +
        `start its own, or restart it as \`pnpm dev:e2e\`.`,
      timeout: 15_000,
    })
    .toBeGreaterThan(sentBefore);

  const link = linksTo(await readOutbox(), email, pattern).at(-1);
  expect(link, `no ${what} URL in the email sent to ${email}`).toBeTruthy();

  return link!;
}

function extractLink(entry: OutboxEntry, pattern: RegExp) {
  return pattern.exec(`${entry.text}\n${entry.html ?? ""}`)?.[0]?.replaceAll("&amp;", "&");
}
