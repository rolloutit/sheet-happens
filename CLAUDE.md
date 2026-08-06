# Sheet Happens

Internal, single-tenant time & timesheet app (time tracking → monthly timesheet revisions →
contractor invoice verification → reports/PDF export). Next.js App Router + React 19,
Prisma/Postgres, Better Auth, Tailwind v4, next-intl (HU/EN), Storybook.

## Commands

pnpm only — `packageManager: pnpm@11.5.3`, Node `24.14.0` (`.nvmrc`). Never npm or yarn.

- `pnpm setup:git` — run once per clone: installs the pre-push guard and the push defaults that
  keep a feature branch off `develop`. Local git config only, never global.
- `pnpm dev` — Next dev server (Turbopack) on `:3000`
- `pnpm db:dev` — start Postgres 17 + MinIO in Docker, migrate, seed. Also `db:dev:reset`,
  `db:dev:seed`, `db:dev:stop`. Requires Docker running.
- `pnpm db:generate` — regenerate Prisma client after any schema edit
- `pnpm typecheck` · `pnpm lint` · `pnpm format` (check only; `pnpm format:write` fixes)
- `pnpm test` — Vitest/jsdom, picks up `src/**/*.test.{ts,tsx}` only. Filter while iterating:
  `pnpm test src/lib/duration.test.ts`
- `pnpm test:browser` — Vitest browser mode, `src/**/*.browser.{test,spec}.{ts,tsx}`
- `pnpm storybook` · `pnpm test-storybook`
- `pnpm test:visual` — rebuilds Storybook, compares checked-in screenshots
- `pnpm e2e` — Playwright; boots `pnpm dev` itself, no separate server needed
- `pnpm verify` — the full gate chain. Run it before calling a feature done. (Not `pnpm ci`: pnpm
  has a built-in `ci` that shadows package scripts and silently runs a clean install instead.)

## Environment

- Copy `.env.example` → `.env.local`. Never edit or commit `.env`/`.env*.local`.
- PDF export (`src/server/pdf`) shells out to Typst: needs `typst` on PATH or `TYPST_BIN` set
  (pin 0.15.1 to match the Dockerfile). Production runs it from the Dockerfile image.
  `pnpm test:pdf` renders the templates for real; plain `pnpm test` never invokes Typst.
- Object storage is S3-compatible; local dev uses MinIO on `:9000` (console `:9001`).

## Architecture rules

- **Prisma schema is split** across `prisma/*.prisma` (`schema.prisma` + one file per domain);
  `prisma.config.ts` points at the `prisma/` folder, not a single file. The client is generated to
  `src/server/db/generated` (gitignored, ESLint-ignored) — run `pnpm db:generate` after schema
  edits. Deploys run `pnpm db:migrate:deploy`.
- **Server Components by default.** Add `"use client"` only for local state, effects, browser APIs,
  timers, overlays, rich forms, and Radix interactive primitives.
- **Server Actions stay thin**: authenticate → authorize → validate with Zod → call
  `src/server/<domain>` → return a typed result. Domain and DB logic lives in `src/server/*`,
  never in components or route files.
- **PDF documents are Typst templates, never generated markup.** Layout lives in
  `src/server/pdf/templates/*.typ` (`lib/theme.typ` for tokens, `lib/components.typ` for blocks);
  TypeScript only builds a display-ready JSON payload (`report-pdf-payload.ts`) that the template
  reads via `json("/data.json")`. Never concatenate values into Typst markup — that is what the old
  hand-rolled escaping existed for. Do all number/money/date formatting in TS via
  `src/lib/formatting` so `Intl` stays the single authority; templates contain no locale logic.
- No Redux, Zustand, or TanStack Query in v1. Local React state for component UI state; URL search
  params for shareable table/filter state.
- Import alias `@/*` resolves to the repo root.
- `typedRoutes` is enabled — route strings are type-checked, so run `pnpm typecheck` after adding
  or renaming a route.
- Server Action body limit is 12 MB (file uploads); larger uploads need a different path.

## i18n is a completion requirement

Every user-facing string must exist in **both** `messages/hu.json` and `messages/en.json` — labels,
validation messages, empty/error states, toasts, dialogs, and auth emails. Server code localizes via
`getTranslations`. A feature is not done until both locales are complete.

## Components

Follow `src/components/README.md`. In short:

- One PascalCase folder per component: `Name/Name.tsx`, `Name.types.ts`, `Name.variants.ts` (CVA),
  `index.ts` as the only public import surface; stories and tests colocated.
- `src/components/ui` = shadcn/Radix primitives · `sheet` = product blocks · `layout` = shell/nav.
- Model visual differences as typed variant props (`variant`, `size`, `tone`, `density`, `state`,
  `status`), not boolean clusters like `primary`/`danger`/`small`.
- Reusable components need Storybook coverage for variants, disabled/loading/error/empty, dark and
  light theme, and mobile states. Behavior needs a Storybook `play` test or a Vitest test.
- Theme is a light/dark/**system** preference (next-themes, `system` by default). `:root` is the
  dark palette, `.light` overrides it — check both.

## Testing conventions

- Unit and domain tests colocate as `*.test.ts` beside the source under `src/`.
- Visual baselines in `visual/storybook.spec.ts-snapshots/` are checked in and platform-suffixed
  (`-darwin`). Refresh with `pnpm test:visual:update` **only** for an intentional visual change, and
  say so in the commit.
- User-visible changes get a matching scenario appended to `docs/manual-qa-test-plan.md`, committed
  separately as `docs(qa): ...` (established repo convention).

## Git

Detailed workflow lives in the `/git-workflow` skill (`.claude/skills/git-workflow/`).

- Branch off `develop`; never commit directly on `develop` or `main`. Names: `feature/<topic>`,
  `fix/<topic>`, `chore/<topic>`, `docs/<topic>`.
- Create branches with `git switch -c <name> --no-track origin/develop`. Without `--no-track` the
  branch inherits `origin/develop` as its upstream and a plain `git push` lands the work straight on
  `develop`. Push with `git push -u origin <branch>`, never a `HEAD:<other-branch>` refspec.
- Conventional Commits: `type(scope): imperative subject`, lowercase, no trailing period.
- **YOU MUST NEVER push to a remote** and never rewrite history that exists on `origin`. Commit
  locally, then hand the push and PR to the developer. `git push` is blocked by a deny rule in
  `.claude/settings.json`.

## Reference docs — read on demand, don't duplicate here

- `docs/domain-model.md` — entities, state machines, invariants, authorization boundaries. Read
  before changing timesheet, rate, or invoice logic.
- `docs/database-schema.md` · `docs/auth-user-management.md` · `docs/frontend-stack.md`
- `docs/tokens.md` — design tokens · `docs/component-library-audit.md` — component inventory
- `docs/local-dev-db.md` · `docs/manual-qa-test-plan.md`
- `docs/railway-projects.md` — deployed project/environment topology, domain moves, deployed-DB
  access, and why config lives in `railway.json` rather than Railway IaC. Read before changing
  anything on Railway.

## Working agreements

- For multi-file or unfamiliar changes: explore and plan first, then implement. Skip planning for
  one-line fixes.
- Verify with a real gate (`pnpm typecheck`, `pnpm test`, the failing test you just wrote) and show
  the output instead of asserting success. If a check fails, say so with the output.
- Match surrounding code style. Don't add a dependency, migration, or new top-level directory
  without asking first.
- Timesheet revisions are immutable financial snapshots — never make submitted revisions recompute
  from live time entries (see `docs/domain-model.md`).
