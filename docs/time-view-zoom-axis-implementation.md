# Time View Zoom Axis — Implementation Steps

Operational companion to `docs/time-view-zoom-axis.md`. That document is the **reference** — the
reasoning, the data model, the verified constraints. This one is the **running order**: five steps,
each a branch and a PR, each shippable on its own.

Read the design doc section by section as each step needs it. Do not try to hold all of it at once,
and do not restructure or reformat it.

---

## Settled decisions

Every open decision in §17 of the design doc is resolved as recommended. Treat these as given —
do not re-open them.

| §17 | Decision                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Default level is `week` for a member with tracked assignments; `month`, forced, for a declared-only member                                                                                                                |
| 2   | Retire `DayDetailPanel` — the folder, its export, and its visual baseline                                                                                                                                                 |
| 3   | L3 stays inline-editable at its zoom stop                                                                                                                                                                                 |
| 4   | Capacity bars ship in v1, using the existing `DAILY_SOFT_WARNING_MINUTES` (8h) as the implicit daily target                                                                                                               |
| 5   | A declaration's `note` is **always human-written and required** — by the member, or by the admin when an admin creates one. There is no generated string, so no language question arises                                  |
| 6   | A mode switch is **refused** when the open month already holds data of the other kind, with an error naming what has to be removed first                                                                                  |
| 7   | An admin can enter and correct a declared figure, mirroring the existing `adminModified*` fields and the `TIME_ENTRY_ADMIN_MODIFIED` notification                                                                         |
| 8   | A report **discloses** that it excluded declared hours — a header and PDF line naming how many members and projects were omitted, no amounts, in both report modes. Word it so it survives being read outside the company |
| 9   | The two tracks ship separately — which is what the five steps below are                                                                                                                                                   |

---

## Working rules

These apply to every step. `CLAUDE.md` is the authority; this is the subset that is easy to get
wrong here.

**Git**

- Step 1 branches off `develop`: `git switch -c <name> --no-track origin/develop`.
- A later step branches off `develop` once the previous PR is merged. If it is not merged yet, branch
  off the previous step's branch and say so in the PR description.
- Never commit on `develop` or `main`. **Never push** — `git push` is blocked by a deny rule. Commit
  locally and hand the push and the PR to the developer.
- Conventional Commits: `type(scope): imperative subject`, lowercase, no trailing period.
- The QA scenario is its own commit, `docs(qa): …`, per repo convention.
- If `CLAUDE.md` shows up modified in your diff, that is `next dev` rewriting its own block. Commit it
  with the work rather than reverting it.

**Gates**

- Run them individually: `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm test`,
  `pnpm test-storybook`, `pnpm test:visual:static`.
- **Do not rely on `pnpm verify`.** A flaky Storybook test (`NotificationButton > Unread`) fails
  roughly two runs in three and stops the chain _before_ the visual and e2e steps, so a green
  `verify` is not evidence and a red one is not necessarily your fault. Run the steps yourself and
  show the output.
- Refresh visual baselines only for an intentional visual change, with
  `pnpm test:visual:update`, and say so in the commit message.

**Scope discipline**

- The only new runtime dependency authorised is **`motion`** (Step 2). The only migration authorised
  is the one in Step 3. Anything else — a third dependency, a new top-level directory, a second
  migration — needs asking first.
- `pnpm db:generate` after any schema edit. Never `pnpm db:migrate:deploy` against anything but a
  local database.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code. This
  Next version has breaking changes relative to what you may remember.

**Line numbers**

The design doc's `file.ts:123` references were accurate when it was written and drift the moment you
start editing. Treat each as a pointer to a **symbol** — `buildReportTimeEntryWhere`,
`assertDailyTotals`, `deriveFlaggedUsers`, `resolveTimesheetLineRate`, `selectedDayIso` — and grep for
the symbol.

**Definition of done, every step**

1. The gates above pass, with output shown.
2. Both `messages/hu.json` and `messages/en.json` are complete. A feature is not done in one locale.
3. New reusable components have Storybook coverage for variants, empty/loading/error, dark and light,
   and mobile.
4. New behaviour has a Vitest test or a Storybook `play` test.
5. A scenario is appended to `docs/manual-qa-test-plan.md` in its own `docs(qa):` commit.
6. Stop. Report what you did, what you verified, and what you deliberately left out. Hand the PR to
   the developer.

---

## Step 1 — The axis foundation

Branch: `feature/time-zoom-axis`

**Goal.** `/time` gets a real three-stop axis whose state lives in the URL, and the itemized week —
the level that has been missing — exists.

Design doc: §1, §2 (the axis table), §5, §6, §7, §10, §11, §12.

**In scope**

- `zoom` and `day` search params, written with `history.replaceState` — extend
  `src/lib/use-overlay-param.ts` or add a sibling hook. Never `router.push`: the page is
  `force-dynamic` and a push re-issues its database queries for data the client already holds.
- Remembered level in `localStorage`, applied only when `?zoom=` is absent. Read it in an effect to
  avoid a hydration mismatch.
- Replace the hand-rolled two-button pill in `TimeGridClient.tsx` with
  `src/components/ui/SegmentedControl`. Three stops for now: Day, Week, Grid.
- Keyboard: `1`/`2`/`3` jump, `−`/`+` step, `[`/`]` weeks, `t` today. Shortcuts must not fire while a
  text input or textarea has focus. **Do not claim the arrow keys** — they are reserved for
  spreadsheet navigation in L3.
- `src/components/sheet/WeekAgenda/` — the L2 level. Desktop: seven day columns with sticky day
  headers, entry cards, a per-column add affordance, and columns that scroll as one page. Mobile: an
  accordion, selected day expanded, others collapsed to one summary row.
- `src/components/sheet/DayAgenda/` — extracted from the local `DayView` inside
  `TimeGridClient.tsx`. **Behaviour-preserving extract**, no redesign.
- Retire `DayDetailPanel`: delete the folder, its exports from `src/components/sheet/index.ts`, and
  `visual/storybook.spec.ts-snapshots/day-detail-panel-dark-desktop-darwin.png`.
- `app/time/TimeZoomShell.tsx` — owns zoom state and renders the persistent day strip.
- Continuity contract items 1, 3, 4 and 5 already hold, without any animation: the selected day
  survives every transition in both directions, totals do not remount, focus is not dropped, and
  zooming in scrolls the target day into view.
- Real semantics for L2: a heading per day and a list per column, not a grid of `div`s.

**Out of scope.** Motion. Capacity bars. The month level. Anything about tracking modes.

**Watch for**

- All three levels read the same `week.entries` the page already loads. Add no queries.
- The `DayAgenda` extract is the easiest thing here to get subtly wrong. Existing tests stay green,
  and the day view looks and behaves identically before and after.
- Presentational components take data and callbacks. Server mutations and optimistic state stay in
  `TimeGridClient.tsx`.

## Step 2 — Motion and the continuity contract

Branch: `feature/time-zoom-motion`

**Goal.** The level changes read as one surface moving rather than three screens swapping.

Design doc: §7, §9, §15.

**In scope**

- `pnpm add motion`. Load it as `LazyMotion` + `motion/react-m`, with `motion-features.ts` exporting
  `domMax` behind a dynamic import, and `strict` on `LazyMotion`.
- Motion tokens added to `app/globals.css`, documented in `docs/tokens.md`, mirrored as literals in
  `app/time/motion.ts` with a comment naming the token table as the source of truth.
- `<MotionConfig reducedMotion="user">` at the `/time` client root.
- Layout transitions: `layout` plus the shared `layoutId` scheme in §7 item 6. `initial={false}` on
  the root so nothing animates on first paint. Entering cards staggered and **capped**; exits opacity
  only.
- **Numbers never tween.** Totals and cell values crossfade or swap.
- Capacity bars under the day chips, using `DAILY_SOFT_WARNING_MINUTES` (8h) as the implicit target.
- `aria-live="polite"` announcement on a level change.
- Visual baselines captured with animations disabled, so a mid-transition frame can never land in a
  baseline.

**Watch for**

- The global `prefers-reduced-motion` block in `app/globals.css` kills CSS durations and **does
  nothing to Motion**, which animates outside CSS transitions. `MotionConfig` is required, not
  belt-and-braces. Verify with the OS setting on, not only in DevTools.
- Confirm the feature bundle you load actually carries layout projection. `domAnimation` does not;
  `domMax` does.
- Do not put `layout` on grid cells. L3 can be 70 cells and each participant costs a measure pass per
  frame. Budget: 30 participants per transition, 60fps with a 40-entry week.

## Step 3 — Tracking modes: schema, resolver, admin

Branch: `feature/tracking-modes-schema`

**Goal.** Admins can classify who tracks hours here and who declares them monthly. Nothing changes
for members yet.

Design doc: §3, §8 (Admin configuration), §19.

**In scope**

- `prisma/enums.prisma`: `TrackingMode { TRACKED, DECLARED }`, `EntrySource.DECLARED`,
  `DocumentType.HOURS_PROOF`.
- `prisma/identity.prisma`: `Member.defaultTrackingMode`, defaulting to `TRACKED`.
- `prisma/projects.prisma`: `ProjectAssignment.trackingMode`, **nullable** — `null` inherits the
  member default.
- `prisma/time-tracking.prisma`: `MonthlyHourDeclaration` exactly as specified in §3, including
  `@@unique([memberId, projectId, periodStart])`, a non-nullable `note`, and the `adminModified*`
  fields. Add the `hoursDeclaration` back-relation on `Document`.
- One migration. `pnpm db:generate`.
- `src/server/time-tracking/tracking-mode.ts` — `resolveTrackingMode(member, assignment)`, the single
  authority, mirroring how `resolveTimesheetLineRate` is the single authority for rates.
- Admin configuration in `app/admin/projects`: the member-level default, and the per-assignment
  override with an explicit **inherit** state so an admin can see which assignments are deliberately
  different.
- Refuse a mode switch when the open month already holds data of the other kind, with an error naming
  what has to be removed first.

**Out of scope.** Any member-facing change. The declaration UI. Writing declarations.

**Watch for**

- The Prisma schema is split; these changes land in four files, not one.
- **Pause before the PR and ask the developer to review the migration SQL.** This is a financial
  database.
- The mode governs what a member may create _now_. It is deliberately not time-versioned — do not add
  a period table for it.

## Step 4 — The month level

Branch: `feature/time-zoom-month`

**Goal.** L4 exists as the fourth stop, showing per-project monthly totals for hours tracked here.

Design doc: §5 (which stops a member gets), §8, §11.

**In scope**

- `src/server/time-tracking/month-overview.ts` — `getMemberMonthOverview`: per-project sums plus the
  month's declaration rows. **No per-entry month data** — that is what keeps this cheap.
- The month payload ships alongside the week on every `/time` load, for **every month the visible week
  touches** (one or two). This is what makes L4 reachable with no round-trip, which in turn is what
  lets the level transition stay a pure layout animation.
- `src/components/sheet/MonthOverview/` — month header with label, month total, previous/next month,
  and the **tracked band** of one row per project. Rows, not cards.
- Month added as the fourth stop; the stop list derived from the member's assignments.
- **The month comes from `day`, never from `week`** — a week can span two months, and the current
  week in the design doc's own screenshot does exactly that (Aug 31 – Sep 6, 2026). At L4, `[` and `]`
  set `day` to the 1st of the adjacent month and `week` to the week containing it.
- L4 → L3 click-through on a tracked project row: a pure level change, landing on the week the day
  strip already points at. Not a filter.
- The day strip stays mounted at L4, de-emphasised.
- A Vitest test for the month-from-`day` rule across a month-spanning week.

**Out of scope.** The declared band. Proof upload.

## Step 5 — Declared hours, end to end

Branch: `feature/declared-monthly-hours`

**Goal.** A member whose hours live in another company's system declares one figure per project per
month with a proof PDF, their timesheet works exactly as it does today, and the admin can compare
hours, proof and invoice.

Design doc: §3, §4 (all of it), §8, §13, §15, §16.

**In scope — the write path**

- `src/server/time-tracking/declarations.ts` — create, update and delete, each materializing or
  updating **exactly one** `TimeEntry` in the same transaction: `source = DECLARED`,
  `durationMinutes = minutes`, `localDate = periodStart`, `description = note`. Editing updates the
  same entry, never a second one. Deleting soft-deletes it.
- Guard both write paths: a declared assignment may not have ordinary time entries, and a tracked
  assignment may not have a declaration. Without this the month double-counts.
- An admin can create and correct a declaration, recording `adminModified*` and firing the existing
  `TIME_ENTRY_ADMIN_MODIFIED` notification.
- A warning — not a block — above 24h × days-in-month.

**In scope — the UI**

- `src/components/sheet/DeclaredHoursRow/` — hours input parsed to minutes, required note, proof slot,
  and a locked variant. Its own stories and tests: empty, filled, proof missing, proof uploaded,
  upload rejected, locked.
- The declared band in `MonthOverview`. A declared-only member gets Month only, with **no**
  `SegmentedControl` rendered and both band headings dropped.
- The L1–L3 handoff line — _"Nimbus is declared monthly — see Month"_, the project name linking to
  L4, two or more collapsing to a count. A line under the day strip, not a banner.
- Proof upload: PDF only, one per declared assignment per month, following the `uploadPayslip`
  precedent — a Server Action into `ObjectStorage.put` with a per-type file validator. The 12 MB
  Server Action body limit must produce a real error message, not a silent failure. Replaceable while
  unlocked, view-only after.

**In scope — the boundary (§4, every item)**

- `getMemberWeeklyTimeGrid` excludes `source: DECLARED` from `entries`. **Exclude at the query, not at
  the render**, so L1–L3 cannot see a declared entry and no downstream filter can be forgotten.
- `buildReportTimeEntryWhere` excludes `source: DECLARED` — one function, and every report consumer
  inherits it.
- `assertDailyTotals` excludes `source: DECLARED` from its own query. This is separate from the report
  filter: without it, an admin editing a _tracked_ line dated the 1st still trips the 24h check on the
  declared figure sitting beside it.
- `submit-timesheet.ts` blocks submission while any declared assignment in the month has hours but no
  proof, as a new error beside the existing missing-description and missing-rate guards. Employees
  have no submission gate, so their missing proof is a warning on `/time` and in the admin review.
- `admin-review.ts` gains `AdminTimesheetReviewProject.trackingMode` and `.declaredProof` (document
  id, filename, content type, byte size, uploaded-at), viewed through the existing `DocumentPreview` /
  `PdfViewer` and the same signed-URL access the invoice viewer uses. A declared line's date reads as
  "September · declared", not "Sep 1".
- Declared assignments flag on a **monthly** rhythm in `deriveFlaggedUsers`, not a weekly one, and
  `InactiveProjectWeek` is not offered for them.
- The report disclosure line in the header and the PDF: how many members and projects were omitted, no
  amounts. A member with only declared assignments stays selectable in the report filters, so the
  empty result needs an empty state that says _why_.

**The two tests that are the feature's contract** — assert them next to each other:

1. A report over a hybrid project returns only the tracked hours.
2. The admin review over that same month returns the declared line, its total and its proof.

Plus the money test: the month-start rate applies to the whole declared figure, including across a
mid-month rate change, and the declared line lands in the snapshot with the right amount.

**Watch for**

- Cover the **hybrid** member explicitly in the QA scenarios. It is the case most likely to be got
  wrong, and the one the design of L4 exists to serve.
