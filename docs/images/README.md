# Product screenshots

Used by the README and the website. Every image comes from the seeded demo data (fake people, `example.com` addresses), in English, at 1440 px wide with a device scale factor of 2, then resized to 1600 px (the mobile shot to 780 px) and reduced to an 8-bit palette to stay under 400 KB.

| File                       | Shows                                                                                                                                       | Route                                                                            | Theme |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----- |
| `time-week-dark.png`       | Weekly time tracking with entries (hero image), contractor view of the frozen demo week                                                     | `/time?week=2025-03-03`                                                          | dark  |
| `time-week-light.png`      | Same screen                                                                                                                                 | `/time?week=2025-03-03`                                                          | light |
| `time-week-mobile.png`     | Same week on a phone (390×844), day view with bottom navigation                                                                             | `/time?week=2025-03-03`                                                          | dark  |
| `timesheet-month.png`      | Monthly timesheet with the workflow stepper (Assembled → Submitted → Approved → Invoice → Paid)                                             | `/timesheets?month=2026-09`                                                      | dark  |
| `timesheet-revision.png`   | Admin approval of an immutable submitted revision, with approve and reject actions                                                          | `/admin/timesheets/<id>` (status Submitted)                                      | dark  |
| `invoice-verification.png` | Invoice reconciliation: system total against invoice total, metadata, accept or reject (the embedded PDF preview is blank in the seed data) | `/admin/timesheets/<id>` (status Invoiced), scrolled to "Invoice reconciliation" | dark  |
| `reports.png`              | Reports with totals, charts and the PDF export button                                                                                       | `/admin/reports`                                                                 | dark  |
| `security-settings.png`    | Sign-in methods: magic link, password, passkeys, authenticator app                                                                          | `/settings` → Security and sign-in                                               | dark  |

## Re-taking them

1. Start Postgres and MinIO (`pnpm db:dev`, or `pnpm db:test` when ports 5432/9000 are taken, with `DATABASE_URL` and `S3_ENDPOINT` pointing at your own instances), then `pnpm dev:e2e`.
2. Mint the two sessions once: `pnpm exec playwright test --project=setup` writes `e2e/.auth/admin.json` and `e2e/.auth/member.json`.
3. Open each route above on `http://localhost:3000` (never `127.0.0.1`) with those storage states, the `sheet-happens-locale=en` cookie and `localStorage.theme` set to `dark` or `light`. Use a 1440×900 viewport (1440×720 for the week view, 390×844 for mobile) at scale factor 2.
4. Wait for fonts and data, dismiss the "Got it" hint, hide the Next.js dev indicator, and hide the PDF iframe on the invoice screen.
5. Resize to 1600 px wide and quantize (for example `magick in.png -resize 1600x -colors 192 PNG8:out.png`, then `optipng`).

The week view uses the frozen demo week (`FROZEN_WEEKS` in `scripts/dev-seed.mjs`) because it never changes. The other screens show data relative to the seeding date, so retake them when the seeded months have moved on.
