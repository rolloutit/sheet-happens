/**
 * Signs in once per role through the application's real magic-link flow and stores the resulting
 * session as a Playwright storage state, so specs never log in through the UI.
 *
 * Links are read from the file outbox (`AUTH_EMAIL_DELIVERY_MODE=file`, wired in
 * `playwright.config.ts`) rather than from a seeded password or a forged cookie: the harness stays
 * on the same code path a real user takes, and no secret ever enters the test process.
 *
 * Both roles have to be *onboarded*, not merely logged in. The dev seed leaves every member row
 * INVITED or unlinked, and `canCreateAuthUser` (src/server/auth/invite-policy.ts) mints an auth
 * user only for a member that is INVITED with a live PENDING invitation — so signing in produces a
 * session whose member row still has no `auth_user_id`, which `requireActiveAppMember` bounces
 * straight to /account-status. Accepting the invitation is what links the row, and until that has
 * happened no authenticated spec can reach a single page.
 *
 * `contractor@example.com` is the only seeded *member* in that shape, which is why it is the member
 * role here; `admin@example.com` is the only seeded admin, and it has to bootstrap itself, because
 * resending an invitation needs an admin session that does not exist yet.
 *
 * The two roles run serially because the member step needs the admin session to resend the
 * invitation it then accepts. `fullyParallel` is on, so without this the two would race.
 */
import { existsSync } from "node:fs";

import {
  expect,
  test as setup,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { countLinks, INVITATION_LINK, MAGIC_LINK, waitForNewLink } from "./outbox";

setup.describe.configure({ mode: "serial" });

/** Pinned into every stored session so aria snapshots cannot drift between HU and EN. */
const SNAPSHOT_LOCALE = "en";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_STATE = "e2e/.auth/admin.json";
const MEMBER_EMAIL = "contractor@example.com";
const MEMBER_STATE = "e2e/.auth/member.json";

/**
 * The bootstrap admin's invitation token, as planted by scripts/dev-seed.mjs — which also prints
 * the acceptance URL at the end of every `pnpm db:dev:seed`.
 *
 * The one place this harness takes a token from anywhere but an email, and only because there is
 * nowhere else for it to come from: `invitations.token_hash` stores a hash, and a resend needs an
 * admin session, which is precisely what does not exist before the first admin is activated. Every
 * other token in this file is read out of delivered mail.
 */
const SEEDED_ADMIN_INVITE_TOKEN = "dev-admin-invite-token";

setup("authenticate as an admin", async ({ page, context, request }) => {
  await signInWithMagicLink(page, request, { email: ADMIN_EMAIL, callbackURL: "/dashboard" });

  // A freshly seeded admin is INVITED and unlinked, so the callback cannot land on /dashboard yet
  // — `requireActiveAppMember` sends it to /account-status. Accepting the seeded invitation is
  // what writes `members.auth_user_id`, and it only has to happen once per database.
  if (!isOn(page, "/dashboard")) {
    await page.goto(`/accept-invite?token=${SEEDED_ADMIN_INVITE_TOKEN}`, {
      waitUntil: "domcontentloaded",
    });
    await activateInvitation(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  }

  await expect(page).toHaveURL(/\/dashboard$/);

  await saveSignedInState(context, page, ADMIN_STATE);
});

/**
 * The member session, onboarded end to end the first time and reused afterwards.
 *
 * The invitation chain is playable exactly once: it leaves the member ACTIVE and linked, after
 * which `resendMemberInvitation` refuses ("Only pending invited members can be resent an invite.")
 * and `canCreateAuthUser` returns false. So the branch below is not an optimisation — a setup that
 * only ran the chain would fail on its second run, and one that only signed in would fail on a
 * freshly seeded database.
 *
 * A stored member session is reused while the server still accepts it, because a magic link is not
 * free: `/sign-in/magic-link` allows 5 requests per 15 minutes per IP (src/server/auth/auth.ts),
 * and every request from this suite shares the one localhost budget. Minting a second link on
 * every run would halve how often a developer can run `pnpm e2e` before the setup starts failing
 * for a reason that has nothing to do with the code under test. Onboarding happens once per
 * database, so caching its outcome matches the domain rather than working around it — and the
 * sign-in flow itself is still exercised on every run by the admin step above.
 */
setup("authenticate as a member", async ({ browser, page, context, request }) => {
  if (await isStoredSessionUsable(browser, MEMBER_STATE, MEMBER_EMAIL)) return;

  const acceptPath = await resendPendingInvitation(browser);

  await signInWithMagicLink(page, request, {
    email: MEMBER_EMAIL,
    // Straight to the invitation when there is one to accept: an INVITED member has no access to
    // /dashboard yet, so requireActiveAppMember would bounce that callback to /account-status.
    callbackURL: acceptPath ?? "/dashboard",
  });

  if (acceptPath) {
    await activateInvitation(page);
  }

  // Arrival on /dashboard is the proof that the member is ACTIVE *and* linked. The email alone
  // proves nothing: `canSendAuthLink` never looks at the link state, so a magic link is delivered
  // to any ACTIVE member and only fails once it is redeemed.
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard$/);

  await saveSignedInState(context, page, MEMBER_STATE);
});

/**
 * Whether a stored state still carries a session the app accepts for `email`.
 *
 * Both halves matter: /dashboard is guarded by `requireActiveAppMember`, so reaching it proves the
 * app — not merely Better Auth — is willing to serve this session, while the session's own email
 * proves the file holds the identity the caller asked for rather than another role's.
 */
async function isStoredSessionUsable(browser: Browser, path: string, email: string) {
  if (!existsSync(path)) return false;

  const context = await browser.newContext({ storageState: path });

  try {
    const session = await context.request.get("/api/auth/get-session");
    const user = session.ok()
      ? ((await session.json()) as { user?: { email?: string } } | null)
      : null;

    if (user?.user?.email !== email) return false;

    const page = await context.newPage();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    return isOn(page, "/dashboard");
  } finally {
    await context.close();
  }
}

/** Where the page ended up, ignoring the query string a redirect may have appended. */
function isOn(page: Page, pathname: string) {
  return new URL(page.url()).pathname === pathname;
}

/**
 * Resends the seeded invitation from the admin's own People page and returns its acceptance path,
 * or `null` when the member has already been onboarded and needs nothing but a sign-in.
 *
 * Whether the chain still has to run is a fact about the database, and the People row is where the
 * app itself states it — so the state badge decides, rather than a guess about run order.
 *
 * A resend rather than the seed's own plaintext token (`dev-contractor-invite-token`, checked into
 * scripts/dev-seed.mjs): the resend rotates `invitations.token_hash`, so any earlier token — the
 * seed's included — is dead the moment an admin uses this menu for real.
 */
async function resendPendingInvitation(browser: Browser) {
  const context = await browser.newContext({ storageState: ADMIN_STATE });
  const page = await context.newPage();

  try {
    await page.goto(`/admin/people?q=${encodeURIComponent(MEMBER_EMAIL)}`, {
      waitUntil: "domcontentloaded",
    });

    const row = page.getByRole("row").filter({ hasText: MEMBER_EMAIL });
    await expect(
      row,
      `${MEMBER_EMAIL} is not in /admin/people — is the dev seed applied?`,
    ).toHaveCount(1);

    if (!(await row.getByText("invited", { exact: true }).count())) {
      return null;
    }

    const sentBefore = await countLinks(MEMBER_EMAIL, INVITATION_LINK);

    // Radix needs its handlers attached, and the trigger is in the DOM before React hydrates, so
    // an early click lands on markup that does nothing. Retrying the open is the honest wait.
    const trigger = row.getByRole("button", { name: /^Open actions for / });
    await expect(async () => {
      await trigger.click();
      await expect(page.getByRole("menu")).toBeVisible();
    }).toPass({ timeout: 15_000 });

    await page.getByRole("menuitem", { name: "Resend invitation" }).click();
    await expect(page.getByRole("status")).toContainText(`Invitation resent to ${MEMBER_EMAIL}.`);

    const link = await waitForNewLink({
      email: MEMBER_EMAIL,
      pattern: INVITATION_LINK,
      sentBefore,
      what: "invitation link",
    });

    // A path, not the absolute URL: this becomes a Better Auth `callbackURL`, which is validated
    // against the trusted origins rather than taken as given.
    const accept = new URL(link);
    return `${accept.pathname}${accept.search}`;
  } finally {
    await context.close();
  }
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

async function signInWithMagicLink(
  page: Page,
  request: APIRequestContext,
  { email, callbackURL }: { email: string; callbackURL: string },
) {
  const sentBefore = await countLinks(email, MAGIC_LINK);

  const response = await request.post("/api/auth/sign-in/magic-link", {
    data: { email, callbackURL },
  });

  // The status and body are worth carrying into the failure message: a 429 here means the suite
  // has spent the 5-per-15-minutes budget this endpoint allows per IP, which looks nothing like a
  // problem with the code under test.
  expect(
    response.ok(),
    `magic-link request for ${email} failed with ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  const link = await waitForNewLink({
    email,
    pattern: MAGIC_LINK,
    sentBefore,
    what: "sign-in link",
  });

  // Not the default `load`: the Turbopack dev server leaves chunk requests hanging, so `load` can
  // fail to fire on a page that rendered perfectly well. See the note on `visit` in fixtures.ts.
  await page.goto(link, { waitUntil: "domcontentloaded" });
}

async function saveSignedInState(context: BrowserContext, page: Page, path: string) {
  await context.addCookies([
    { name: "sheet-happens-locale", value: SNAPSHOT_LOCALE, url: page.url() },
  ]);
  await context.storageState({ path });
}
