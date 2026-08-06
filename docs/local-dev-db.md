# Local Dev Database

Use the Docker-backed dev database for manual browser testing of auth and invite flows.

```bash
pnpm db:dev
pnpm dev
```

The script starts PostgreSQL, enables the required extensions, runs `prisma db push`, and seeds:

- `admin@example.com`, an invited admin with token `dev-admin-invite-token`
- `contractor@example.com`, an invited contractor with token `dev-contractor-invite-token`
- `employee@example.com`, an inactive employee row for table-state testing

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

## Reports demo data

To manually test `/admin/reports` with realistic data, run once after `pnpm db:dev`:

```bash
pnpm db:dev:seed:reports-demo
```

This adds 6 active members (employees and contractors, mixed EUR/HUF), 6 projects across one
project group, assignments, internal rates (including one project-override rate), and ~2 months of
weekday time entries. It only touches new records — the `admin@example.com` / `contractor@example.com`
/ `employee@example.com` onboarding-flow rows from the base seed are left untouched. Re-running it is
safe; it skips anything it already created. Requires an activated admin login to view the page (see
above).
