/**
 * The authorization boundary, asserted from the side that is supposed to be held back.
 *
 * Two claims, and they are separate on purpose: a role that cannot *see* an admin surface may
 * still be able to *reach* it, and a redirect is worth nothing if the navigation still advertises
 * the destination.
 *
 * Both are read off the app's real behaviour rather than a list of expectations:
 *  - the sidebar renders its `admin` group only for `role === "admin"` (AppShell), so for a member
 *    those destinations must be absent from the accessibility tree, not merely hidden by CSS;
 *  - every admin page guards itself with `requireAdminAppMember`, which redirects an active
 *    non-admin to `accountStatusRoute(callbackURL, "admin-required")`
 *    (src/server/auth/app-access.ts) — so the member lands on /account-status carrying the route
 *    it was refused.
 */
import { expect, test, visit } from "../../fixtures";

/**
 * Admin-group navigation labels that belong to no other group. "Payslips" is deliberately left
 * out: the same label is a member destination for the employee profile, so its absence would
 * assert the profile rather than the role.
 */
const ADMIN_DESTINATIONS = [
  "Approvals",
  "Reports",
  "Projects",
  "People",
  "Rates",
  "Declared hours",
  "Audit log",
  "System",
  "Information page",
];

/** Three admin surfaces that guard themselves independently, rather than one standing for all. */
const ADMIN_ROUTES = ["/admin/people", "/admin/timesheets", "/admin/system"];

test("keeps admin navigation out of the accessibility tree", async ({ page }) => {
  await visit(page, "/dashboard");

  const navigation = page.getByRole("navigation", { name: "Primary navigation" });

  // The member's own rail has to be there, or every assertion below would pass on a blank page.
  await expect(navigation.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Time tracking" })).toBeVisible();

  for (const destination of ADMIN_DESTINATIONS) {
    await expect(
      navigation.getByRole("link", { name: destination }),
      `${destination} is reachable from a member's primary navigation`,
    ).toHaveCount(0);
  }
});

for (const route of ADMIN_ROUTES) {
  test(`redirects a member away from ${route}`, async ({ page }) => {
    await visit(page, route);

    // The refused route travels along as `callbackURL`, so the page can send the visitor straight
    // back once they are signed in with an account that has the role. Asserted in full rather than
    // by shape: dropping the reason would silently turn this into the generic "account not active"
    // screen, which is a different refusal.
    await expect(page).toHaveURL(
      `/account-status?callbackURL=${encodeURIComponent(route)}&reason=admin-required`,
    );
    await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();
  });
}

test(
  "has no WCAG 2.2 AA violations on the refusal it lands on",
  { tag: "@a11y" },
  async ({ page, makeAxeBuilder }, testInfo) => {
    await visit(page, "/admin/people");
    await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();

    const results = await makeAxeBuilder().analyze();

    // Attached so a failure is diagnosable from the report without re-running the suite.
    await testInfo.attach("axe-results.json", {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });

    expect(results.violations).toEqual([]);
  },
);
