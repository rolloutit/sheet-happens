# Local Dev Database

Use the Docker-backed dev database for manual browser testing of auth and invite flows.

```bash
pnpm db:dev
pnpm dev
```

The script starts PostgreSQL, enables the required extensions, runs `prisma db push`, and seeds a
working dataset — team members, projects, assignments, internal rates, and roughly four months of
time entries. It deliberately stops there: no timesheets, contractor invoices, or payslips, so those
flows start from a clean slate and are driven by hand.

**Members** (9). Three drive the onboarding flows:

- `admin@example.com`, an invited admin with token `dev-admin-invite-token`
- `contractor@example.com`, an invited contractor with token `dev-contractor-invite-token`
- `employee@example.com`, an inactive employee row for table-state testing

The other six are active employees and contractors across EUR and HUF, including a second admin
(`emma.toth@example.com`). Every member has an internal rate timeline; four of them have a raise
partway through the seeded window, so rate history and effective dating have something to resolve.

**Projects** (8 in 2 groups). Active, inactive, and archived, one internal (non-billable) project,
one that started only last month, and two that ended inside the seeded window. Assignments include
three project-level rate overrides and several that have already ended.

**Time entries** cover the current month plus the three before it, weekdays only, 6–9 hours per
day, split across a weekly project focus. The mix spans all three entry sources, a couple of
admin-modified entries, and `inactive_project_weeks` markers for recent weeks a member had nothing
to report on an assigned project.

The randomised parts run through a fixed-seed PRNG, so a reset on the same day reproduces the same
dataset. Every insert is idempotent — `pnpm db:dev:seed` against an already-seeded database adds
nothing and touches no existing rows.

Open the first admin invite:

```text
http://localhost:3000/accept-invite?token=dev-admin-invite-token
```

Click `Email sign-in link`, open the magic link printed in the `pnpm dev` terminal, then click `Activate account`. After that, `/admin/people` is available for the real invite flow.

Useful commands:

```bash
pnpm db:dev         # start, push schema, seed
pnpm db:dev reset   # delete the Docker volume, recreate schema, seed
pnpm db:dev seed    # seed the currently running DB only
pnpm db:dev stop    # stop the Docker services, keep the volume
pnpm db:dev:reset   # alias for pnpm db:dev reset
pnpm db:dev:seed    # alias for pnpm db:dev seed
pnpm db:dev:stop    # alias for pnpm db:dev stop
```

The default connection string is:

```text
postgresql://sheet_happens:sheet_happens@localhost:5432/sheet_happens?schema=public
```

Email delivery defaults to console mode. Magic links, invitation emails, and password setup/reset
links are printed by the dev server when `AUTH_EMAIL_DELIVERY_MODE=console`. To use SMTP, set
`AUTH_EMAIL_DELIVERY_MODE=smtp` and the `SMTP_*` variables before starting the Next.js dev server.

Company Google sign-in stays hidden unless all Google env vars are configured:

```bash
AUTH_GOOGLE_CLIENT_ID="..."
AUTH_GOOGLE_CLIENT_SECRET="..."
AUTH_GOOGLE_ALLOWED_DOMAINS="example.com"
```

## Changing the seed

Seed content lives in `scripts/dev-seed.mjs` (members, projects, assignments, rates, time entries);
`scripts/dev-db.mjs` only orchestrates Docker, extensions, `prisma db push`, and the transaction.
Adding a member or project means adding a row to the arrays at the top of `dev-seed.mjs`.
