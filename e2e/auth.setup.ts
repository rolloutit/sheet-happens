/**
 * Signs in once per role through the application's real magic-link flow and stores the resulting
 * session as a Playwright storage state, so specs never log in through the UI.
 *
 * The link is read from the file outbox (`AUTH_EMAIL_DELIVERY_MODE=file`, wired in
 * `playwright.config.ts`) rather than from a seeded password or a forged cookie: the harness stays
 * on the same code path a real user takes, and no secret ever enters the test process.
 */
import { readFile } from "node:fs/promises";

import { expect, test as setup, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_OUTBOX_PATH } from "./outbox";

/** Pinned into every authenticated context so aria snapshots cannot drift between HU and EN. */
const SNAPSHOT_LOCALE = "en";

type OutboxEntry = { sentAt: string; to: string; subject: string; text: string; html?: string };

async function readOutbox(): Promise<OutboxEntry[]> {
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

function findMagicLink(entries: OutboxEntry[], email: string) {
  const message = entries.filter((entry) => entry.to === email).at(-1);
  const body = `${message?.text ?? ""}\n${message?.html ?? ""}`;

  return /https?:\/\/\S*?magic-link\/verify\?[^\s"'<]+/.exec(body)?.[0]?.replaceAll("&amp;", "&");
}

async function signInWithMagicLink(page: Page, request: APIRequestContext, email: string) {
  const alreadySent = (await readOutbox()).filter((entry) => entry.to === email).length;

  const response = await request.post("/api/auth/sign-in/magic-link", {
    data: { email, callbackURL: "/dashboard" },
  });
  expect(response.ok(), `magic-link request for ${email} failed`).toBeTruthy();

  // The server writes the outbox after responding, so the entry lands a moment later.
  await expect
    .poll(async () => (await readOutbox()).filter((entry) => entry.to === email).length, {
      message:
        `No email reached ${E2E_OUTBOX_PATH} for ${email}. The app under test must run with ` +
        `AUTH_EMAIL_DELIVERY_MODE=file — stop any dev server on the port and let Playwright ` +
        `start its own, or restart it as \`AUTH_EMAIL_DELIVERY_MODE=file pnpm dev\`.`,
      timeout: 15_000,
    })
    .toBeGreaterThan(alreadySent);

  const link = findMagicLink(await readOutbox(), email);
  expect(link, `no magic-link URL in the email sent to ${email}`).toBeTruthy();

  await page.goto(link!);
}

setup("authenticate as an admin", async ({ page, context, request }) => {
  await signInWithMagicLink(page, request, "admin@example.com");
  await expect(page).toHaveURL(/\/dashboard$/);

  await context.addCookies([
    { name: "sheet-happens-locale", value: SNAPSHOT_LOCALE, url: page.url() },
  ]);
  await context.storageState({ path: "e2e/.auth/admin.json" });
});
