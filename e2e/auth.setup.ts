/**
 * Signs in once per role through the application's real magic-link flow and stores the resulting
 * session as a Playwright storage state, so specs never log in through the UI.
 *
 * The link is read from the file outbox (`AUTH_EMAIL_DELIVERY_MODE=file`, wired in
 * `playwright.config.ts`) rather than from a seeded password or a forged cookie: the harness stays
 * on the same code path a real user takes, and no secret ever enters the test process.
 *
 * Signing in is not enough on its own. The dev seed leaves `admin@example.com` INVITED with no
 * `auth_user_id`, so a magic link yields a session whose member row is still unlinked — and
 * `requireActiveAppMember` bounces that straight to /account-status, which means no authenticated
 * spec can reach a single page. Accepting the invitation is what links the row, and it only has to
 * happen once per database.
 */
import { readFile } from "node:fs/promises";

import { expect, test as setup, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_OUTBOX_PATH } from "./outbox";

/** Pinned into every authenticated context so aria snapshots cannot drift between HU and EN. */
const SNAPSHOT_LOCALE = "en";

const ADMIN_EMAIL = "admin@example.com";

/**
 * The bootstrap admin's invitation token, as planted by scripts/dev-seed.mjs — which also prints
 * the acceptance URL at the end of every `pnpm db:dev:seed`.
 *
 * The one token this harness takes from anywhere but an email, and only because there is nowhere
 * else for it to come from: `invitations.token_hash` stores a hash, and resending an invitation
 * needs an admin session, which is exactly what does not exist before the first admin is activated.
 */
const SEEDED_ADMIN_INVITE_TOKEN = "dev-admin-invite-token";

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

  // The status and body are worth carrying into the failure message: a 429 here means the suite
  // has spent the 5-per-15-minutes budget this endpoint allows per IP (src/server/auth/auth.ts),
  // which looks nothing like a problem with the code under test.
  expect(
    response.ok(),
    `magic-link request for ${email} failed with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

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

  // Not the default `load`: the Turbopack dev server leaves chunk requests hanging, so `load` can
  // fail to fire on a page that rendered perfectly well. See the note on `visit` in fixtures.ts.
  await page.goto(link!, { waitUntil: "domcontentloaded" });
}

/**
 * Accepts the invitation, which is what writes `members.auth_user_id` and flips the member to
 * ACTIVE (app/accept-invite/actions.ts). The button is enabled only once the server has rendered
 * the panel against a session whose email matches the invitation, so waiting for it to be enabled
 * also confirms the sign-in above landed on the right account.
 *
 * One click, deliberately: activation is not idempotent, so the click-and-retry pattern the specs
 * use for hydration races would risk a second submit against a spent token. It is not needed —
 * the panel submits a Server Action from a real `<form>`, which Next posts natively when the click
 * lands before hydration.
 */
async function activateInvitation(page: Page) {
  // An invalid, expired or already-used token renders an ErrorState where the panel would be.
  // Saying so here turns a silent wait for a button that will never exist into one sentence.
  await expect(
    page.getByRole("heading", { name: "Accept invitation" }),
    `${page.url()} did not render the invitation panel — the token is invalid, expired or spent`,
  ).toBeVisible();

  const activate = page.getByRole("button", { name: "Activate account" });
  await expect(activate).toBeEnabled();
  await activate.click();

  await expect(page.getByRole("heading", { name: "Account activated" })).toBeVisible({
    timeout: 30_000,
  });
}

/** Where the page ended up, ignoring the query string a redirect may have appended. */
function isOn(page: Page, pathname: string) {
  return new URL(page.url()).pathname === pathname;
}

setup("authenticate as an admin", async ({ page, context, request }) => {
  await signInWithMagicLink(page, request, ADMIN_EMAIL);

  if (!isOn(page, "/dashboard")) {
    await page.goto(`/accept-invite?token=${SEEDED_ADMIN_INVITE_TOKEN}`, {
      waitUntil: "domcontentloaded",
    });
    await activateInvitation(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  }

  await expect(page).toHaveURL(/\/dashboard$/);

  await context.addCookies([
    { name: "sheet-happens-locale", value: SNAPSHOT_LOCALE, url: page.url() },
  ]);
  await context.storageState({ path: "e2e/.auth/admin.json" });
});
