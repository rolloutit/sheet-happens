# Contributing to Sheet Happens

Thanks for considering a contribution. Sheet Happens is a small product with a small team, so
focused pull requests that solve one problem are the easiest to review and merge.

By contributing you agree that your contribution is licensed under the [AGPL-3.0](LICENSE), the
same licence as the rest of the project. There is no CLA.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md). For security problems, see
[SECURITY.md](SECURITY.md) instead of opening a public issue. For questions, see
[SUPPORT.md](SUPPORT.md).

## Before you start

For anything larger than a small fix, open an issue or a
[Discussion](https://github.com/rolloutit/sheet-happens/discussions) first so we can agree on the
approach before you spend time on it. Translation fixes and small bug fixes can go straight to a PR.

## Prerequisites

- Node.js as pinned in [`.nvmrc`](.nvmrc)
- pnpm, via corepack (`corepack enable`); the version is pinned in `package.json`. Use pnpm only,
  never npm or yarn
- Docker, for the local Postgres and MinIO (S3-compatible storage)
- Optional: [Typst](https://typst.app) on your `PATH` (or `TYPST_BIN` set) if you work on PDF export

## Local setup

```bash
pnpm install
pnpm setup:git             # once per clone: pre-push guard and push defaults (local git config only)
cp .env.example .env.local # then fill in what the comments in the file ask for
pnpm db:dev                # starts Postgres + MinIO in Docker, migrates, seeds fake data
pnpm dev                   # http://localhost:3000
```

Open the app on `http://localhost`, not `127.0.0.1`: the auth client posts to a fixed origin, so
the other host fails on CORS. After editing the Prisma schema in `prisma/`, run `pnpm db:generate`.

More detail: [`docs/local-dev-db.md`](docs/local-dev-db.md).

## Branches and commits

- Branch off `develop`, and open your pull request **against `develop`**.
- Branch names: `feature/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org): `type(scope):
imperative subject`, lowercase, no trailing period (for example `fix(time): clamp entries at 24h`).

## Checks

| When                    | Command                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| While working           | `pnpm verify:fast` (typecheck, lint, unit tests)                       |
| Before opening a PR     | `pnpm verify` (the full gate chain, needs Docker and the e2e database) |
| Formatting              | `pnpm format` checks, `pnpm format:write` fixes                        |
| Visual regression (Mac) | `pnpm test:visual`; baselines are macOS-only, CI skips them            |
| Browser/e2e             | `pnpm db:test` once per clone, then `pnpm dev:e2e` and `pnpm e2e`      |

Refresh visual baselines (`pnpm test:visual:update`) only for an intentional visual change, and say
so in the commit.

## Project rules that matter

- **Every user-facing string exists in both `messages/hu.json` and `messages/en.json`**: labels,
  validation messages, empty and error states, toasts, dialogs, and auth e-mails. A change is not
  done until both locales are complete.
- **Server Components by default**; add `"use client"` only when you need state, effects, or
  browser APIs. Server Actions stay thin: authenticate, authorize, validate with Zod, call
  `src/server/<domain>`. Domain and database logic never lives in components or route files.
- **Components** follow [`src/components/README.md`](src/components/README.md): one folder per
  component, typed variant props instead of boolean clusters, a Storybook story for each state, and
  a Storybook `play` test or a Vitest test for behaviour.
- **Timesheet revisions are immutable financial snapshots.** A submitted revision must never be
  recomputed from live time entries. Read [`docs/domain-model.md`](docs/domain-model.md) before
  touching timesheet, rate, or invoice logic.
- **PDFs are Typst templates**, not generated markup; see `src/server/pdf`.
- **Don't add a dependency or a database migration** without discussing it in the issue first.
- **User-visible changes** get a matching scenario in
  [`docs/manual-qa-test-plan.md`](docs/manual-qa-test-plan.md).

The rest of the documentation lives in [`docs/`](docs/).

## AI-assisted contributions

AI-assisted contributions are welcome. [`CLAUDE.md`](CLAUDE.md) is the project's guide for coding
agents and a good summary of the conventions above. You are responsible for what you submit:
review the generated code, run the checks yourself, and make sure the PR description is accurate.

## Pull requests

Fill in the pull request template. Keep PRs small and focused, include screenshots for UI changes,
and link the issue it resolves. A maintainer will review it; expect some back and forth.
