# Local Dev Database

Use the Docker-backed dev database for manual browser testing of auth and invite flows.

```bash
pnpm db:dev
pnpm dev
```

The script starts PostgreSQL and MinIO, enables the required extensions, runs `prisma db push`, and
seeds a working dataset — team members, projects, assignments, internal rates, a year of time
entries, and the contractor timesheet months built on top of them. It stops before payslips, so that
flow starts from a clean slate and is driven by hand.

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

**Time entries** cover the current month plus the twelve before it, weekdays only, 6–9 hours per
day, split across a weekly project focus. The mix spans all three entry sources, a couple of
admin-modified entries, and `inactive_project_weeks` markers for recent weeks a member had nothing
to report on an assigned project. A year of history is what gives the report period filters — the
year and custom ranges especially — something to narrow down, across both currencies, all eight
projects, both groups, and both member profiles.

**Timesheets** cover the three closed months before the current one for the four contractors, which
leaves the current month open for time tracking. Every persisted status is on the admin approval
table at `/admin/timesheets`, and each row carries the revision, event, and lock history the real
workflow would have left behind:

| Month        | Marcus Weber             | Sara Klein | Levente Szabó | Contractor Example |
| ------------ | ------------------------ | ---------- | ------------- | ------------------ |
| 3 months ago | `paid`                   | `accepted` | `paid`        | `paid`             |
| 2 months ago | `invoice_rejected`       | `invoiced` | `approved`    | `approved`         |
| Last month   | `submitted` (revision 2) | `rejected` | `submitted`   | `submitted`        |

Some things worth knowing about that table:

- The two `submitted` rows from last month are there for bulk approval; the rejected one has its
  period unlocked and its source entries editable again, which is the state a contractor corrects
  a month from.
- Marcus Weber's last month went through a rejection and a resubmission, so it has two revisions
  with different totals — a corrected entry was added between them.
- The `invoiced` and `invoice_rejected` months have real PDFs in the dev MinIO bucket, because the
  admin invoice preview streams the stored object rather than the database row. The PDFs are
  generated placeholders, not real invoices.
- The `approved` months are the starting point for testing the contractor's own invoice upload, and
  `contractor@example.com` has one so the invite-and-upload flow can be walked end to end.

The randomised parts run through a fixed-seed PRNG, so a reset on the same day reproduces the same
dataset. Every insert is idempotent — `pnpm db:dev:seed` against an already-seeded database touches
no existing rows, and running it twice in a row adds nothing the second time. What it does add is
whatever the moving window opened up: days and months that have no entries yet, so a database seeded
weeks ago catches up to today instead of staying frozen. Days that already have entries and months
that already carry a timesheet are left exactly as they are.

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

`pnpm db:dev` publishes Postgres on `5432` and MinIO on `9000`/`9001`, so stop anything else that
holds those ports first. The `db:*` scripts and the Prisma CLI load `.env` (through `dotenv`), not
`.env.local`: to point them at another Postgres or MinIO, export `DATABASE_URL` and `S3_ENDPOINT` in
the shell. `pnpm db:test` never touches Docker and works against any server reached that way.

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

Seed content lives in `scripts/dev-seed.mjs` (members, projects, assignments, rates, time entries)
and `scripts/dev-seed-timesheets.mjs` (contractor timesheet months, invoices, events, audit trail);
`scripts/dev-db.mjs` only orchestrates Docker, extensions, `prisma db push`, and the transaction.
Adding a member or project means adding a row to the arrays at the top of `dev-seed.mjs`; adding a
timesheet state means adding a scenario to `SCENARIOS` in `dev-seed-timesheets.mjs`, where each one
is a contractor, a month, and the list of workflow steps to replay over it.

Because the seed only ever adds, a month that already has a timesheet is left alone. To get a
scenario back after driving it forward by hand, delete that timesheet — the cascade takes its
revisions, snapshot lines, and invoices with it — and seed again:

```sql
DELETE FROM timesheets WHERE id = '...';
```
