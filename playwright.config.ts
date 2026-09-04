import { defineConfig, devices } from "@playwright/test";

import { E2E_OUTBOX_PATH } from "./e2e/outbox";

// Must be `localhost`, not `127.0.0.1`: the Better Auth client always posts to the origin baked
// into `authOrigin` (src/server/auth/auth.ts), so serving the app from the other host fails every
// auth call on a CORS preflight — silently, as a generic "Failed to fetch".
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

/**
 * Signed-in specs are grouped by *audience*, because "which role runs this" is a property of the
 * spec, not of the route it exercises.
 *
 * `authenticated/` holds what must hold for any signed-in member, and every role project runs it.
 * A spec belongs in one of the role directories only when it is genuinely role-bound, and the two
 * reasons that happens are worth keeping apart:
 *
 *  - `authenticated/admin/` — the surface is admin-only, or the assertion is against the admin's
 *    own fixture data. The committed aria snapshot of a populated `/time` week is the latter: the
 *    dev seed gives each member a different set of entries, so the snapshot can only ever match
 *    one role, while the structural assertions around it (landmarks, one `h1`, a region per
 *    weekday, controls addressed within their day, `aria-pressed`) hold for both.
 *  - `authenticated/member/` — what a non-admin must *not* be able to see or reach, which only
 *    means anything when asserted as a non-admin.
 */
const everyRole = /authenticated\/[^/]+\.spec\.ts$/;
const adminOnly = /authenticated\/admin\/[^/]+\.spec\.ts$/;
const memberOnly = /authenticated\/member\/[^/]+\.spec\.ts$/;
const anonymousOnly = [/auth\.setup\.ts/, /authenticated\//];

export default defineConfig({
  testDir: "./e2e",
  // Aria baselines are the reviewable artefact of this suite, so they live in one obvious
  // committed directory rather than beside each spec.
  snapshotPathTemplate: "e2e/__aria__/{testFileName}/{arg}{ext}",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    // Machine-readable, so a failure can be diagnosed without re-running the suite.
    ["json", { outputFile: "test-results/results.json" }],
    ...(process.env.CI ? [["github"] as const] : []),
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // One server, on the ordinary dev port. A second `next dev` for the same directory is refused by
  // Next itself whatever port it is given, and giving the suite its own `distDir` makes `next dev`
  // rewrite the tracked `tsconfig.json` and `next-env.d.ts` on every switch. So either Playwright
  // starts the server (CI, and locally with nothing running) or it reuses one already started with
  // the file outbox — `pnpm dev:e2e` does exactly that.
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Auth emails go to a file the setup project can read. Refused outside development by
      // getEmailDeliveryMode, so this can never leak plaintext links from a real deploy.
      AUTH_EMAIL_DELIVERY_MODE: "file",
      AUTH_EMAIL_FILE: E2E_OUTBOX_PATH,
      // Local .env.local sets this; CI has no such file and would otherwise bounce every
      // authenticated request to the security-setup screen.
      AUTH_SECURITY_SETUP_MODE: "optional",
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_BETTER_AUTH_URL: baseURL,
    },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: anonymousOnly,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testIgnore: anonymousOnly,
    },
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      testMatch: [everyRole, adminOnly],
      dependencies: ["setup"],
    },
    {
      name: "member",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/member.json" },
      testMatch: [everyRole, memberOnly],
      dependencies: ["setup"],
    },
  ],
});
