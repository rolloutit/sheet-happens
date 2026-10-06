# Time View Zoom Axis — Scope

**Status:** proposal · scope under discussion
**Surface:** `/time` (`app/time/page.tsx`, `app/time/TimeGridClient.tsx`) plus assignment configuration
under `app/admin/projects`
**Relationship to other docs:** read `docs/domain-model.md` before touching entry, lock, rate or
invoice logic — this plan touches all four. `docs/tokens.md` for the motion tokens in §9.

This plan covers two things that turn out to be one thing:

1. Replacing the `Weekly grid` / `Day` mode toggle with a single **resolution axis**.
2. Supporting members who **do not record hours in Sheet Happens at all** — they work for another
   company through us, record time in that company's system, and need to declare one monthly figure
   per project with a proof document.

They belong in one plan because the second feature needs a month-scoped level, and the axis is what
gives it a natural home instead of a bolted-on second surface.

---

## 1. The idea

Semantic zoom is the established pattern for this — Figma, Google Maps, Linear's roadmap,
Fantastical's day-count continuum. One control, monotonic behaviour, no filter clicking. It fits
here because `/time` already has both ends of the axis built; it just presents them as two unrelated
screens with a hard cut between them.

**The invariant that makes it read as one axis:** as you zoom out, coverage grows and detail per item
shrinks — monotonically, at every step. Nothing else about the surface changes.

That invariant is also what makes the declared-hours feature fit. A project whose hours live in
someone else's system has **no day-level and no week-level data** — the only record that exists is
one figure for the month. On a resolution axis such a project simply isn't there at the fine stops
and appears at the coarse one, at the only resolution it has. That is not an exception to the model;
it is the model working.

## 2. Where we are today

Grounded in the current code, because the scope depends on it.

**The axis:**

| Fact                                                                                                               | Where                                           |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| The page already loads the **whole week** server-side — every entry, not just the selected day                     | `app/time/page.tsx` → `getMemberWeeklyTimeGrid` |
| The day view filters that same array client-side                                                                   | `TimeGridClient.tsx:195-197`                    |
| View mode is **local state**, lost on reload; only `?week=` is in the URL                                          | `TimeGridClient.tsx:162`                        |
| The real day view is a **local** `DayView`, ~200 lines inside the client file                                      | `TimeGridClient.tsx:1279`                       |
| The real grid is **inline JSX** in the same file                                                                   | `TimeGridClient.tsx:643+`                       |
| That client file is ~2560 lines / 95 KB, in one file                                                               | —                                               |
| The library's `DayDetailPanel` and `WeeklyTimeGrid` are exported and Storybook-covered but **not used by `/time`** | `sheet/index.ts:33, 224`                        |
| Daily thresholds exist: 8h soft warning, 24h hard limit                                                            | `src/lib/time-entry-limits.ts`                  |
| One motion token exists: `--ease-standard`                                                                         | `globals.css:433` · `tokens.md:271`             |
| A global `prefers-reduced-motion` block kills CSS durations                                                        | `globals.css:1377`                              |
| No `motion` / `framer-motion` dependency yet; no CSP, so Motion needs no `nonce`                                   | `package.json` · `next.config.ts`               |
| `/time` has **no e2e spec** — only `home` and `theme` exist                                                        | `e2e/`                                          |

**The financial chain, which the second feature has to survive:**

| Fact                                                                                                    | Where                                              |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `ProjectAssignment` is already the per-member-per-project join, time-versioned by `validFrom`/`validTo` | `prisma/projects.prisma`                           |
| Rates already use member-default + assignment-override, with `RateSource` recording which applied       | `prisma/rates.prisma` · `resolveTimesheetLineRate` |
| The submission snapshot is built from `tx.timeEntry.findMany`, one line per entry                       | `submit-timesheet.ts:383, 485`                     |
| `TimesheetSnapshotLine.sourceTimeEntryId` is **NOT NULL** and unique per revision, FK `Restrict`        | `prisma/timesheets.prisma`                         |
| Reports aggregate from `db.timeEntry.findMany`                                                          | `reports.ts:324`                                   |
| Submission requires a **non-empty description** on every entry                                          | `submit-timesheet.ts:629`                          |
| Submission has **no upper duration bound** — only `durationMinutes <= 0` is rejected                    | `submit-timesheet.ts:625`                          |
| Locking is `PeriodLock` (member + month) plus `lockedByTimesheetRevisionId` on each entry               | `submit-timesheet.ts:538`                          |
| `PeriodLock.timesheetId` is **required**, and timesheets are contractor-only and monthly-only           | `prisma/timesheets.prisma` · `domain-model.md`     |
| Document uploads go through a Server Action to `ObjectStorage.put`, with a per-type file validator      | `payslips.ts:113` · `storage/object-storage.ts`    |
| Server Action body limit is 12 MB                                                                       | `next.config.ts`                                   |

**Two consequences that shape everything below:**

- The new **week** level needs zero new server work and zero new queries — the data is already in the
  client. This half is a layout, state and motion project.
- The financial chain reads `TimeEntry` **everywhere**. That single fact decides the data model in §3.

## 3. Two tracking modes

Two ways a member's hours reach the system:

| Mode       | Hours come from               | What the member does                               |
| ---------- | ----------------------------- | -------------------------------------------------- |
| `TRACKED`  | Sheet Happens, entry by entry | today's behaviour — grid, form, timer              |
| `DECLARED` | another company's system      | one figure per project per month, plus a proof PDF |

### Where the setting lives

`ProjectAssignment` is already exactly the per-member-per-project join the requirement asks for, and
rates already establish the member-default-plus-assignment-override pattern on it. The mode follows
the same shape:

- `Member.defaultTrackingMode: TrackingMode @default(TRACKED)` — the member-level default.
- `ProjectAssignment.trackingMode: TrackingMode?` — nullable override; `null` inherits the member
  default. Hybrid falls out of this for free: one member, some assignments overridden, some not.
- `resolveTrackingMode(member, assignment)` in `src/server/time-tracking/tracking-mode.ts` is the
  single authority, mirroring how `resolveTimesheetLineRate` is the single authority for rates.

**The mode is deliberately not time-versioned** the way rates are. It governs what a member may
create _now_, not how past records are read — because a declaration and a time entry are distinct
records, so history is self-describing. Assignment-level history is still available where it matters,
since an assignment already has `validFrom`/`validTo`.

New enum: `TrackingMode { TRACKED @map("tracked"), DECLARED @map("declared") }`.

### The declaration record

```prisma
model MonthlyHourDeclaration {
  id                      String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId                String    @map("member_id") @db.Uuid
  projectId               String    @map("project_id") @db.Uuid
  projectAssignmentId     String    @map("project_assignment_id") @db.Uuid
  periodStart             DateTime  @map("period_start") @db.Date
  periodEnd               DateTime  @map("period_end") @db.Date
  minutes                 Int
  note                    String
  timezone                String
  proofDocumentId         String?   @unique @map("proof_document_id") @db.Uuid
  timeEntryId             String    @unique @map("time_entry_id") @db.Uuid
  // audit + adminModified* fields mirroring TimeEntry

  @@unique([memberId, projectId, periodStart])
}
```

- **`minutes`, not hours.** The whole app stores minutes (`durationMinutes`, `parseDurationToMinutes`,
  `formatHours`). The input is hours; the storage is minutes; `src/lib/formatting` stays the single
  authority for display.
- **`@@unique([memberId, projectId, periodStart])`** is the "one number per project per month" rule,
  enforced by the database rather than by application code.
- **`timeEntryId` is required**, not nullable — see below.

Also new: `EntrySource.DECLARED`, `DocumentType.HOURS_PROOF`, and a `hoursDeclaration` back-relation
on `Document` beside the existing `contractorInvoice` / `payslip` / `reportExport` ones.

### Materialization — the key decision

Saving a declaration creates or updates **exactly one `TimeEntry`** in the same transaction:
`source = DECLARED`, `durationMinutes = minutes`, `localDate = periodStart`, `description = note`.

Why: the financial chain reads `TimeEntry` everywhere (§2), and
`TimesheetSnapshotLine.sourceTimeEntryId` is not nullable. Making declarations a _parallel_ source
would force that snapshot line to become polymorphic, which touches the immutable snapshot writer,
the report aggregation, the rate resolver, the invoice comparison and the Typst PDF payload — the
exact code `CLAUDE.md` says not to disturb. Materializing instead confines the change to the write
path: submission, locking, rate resolution, the admin review and invoice verification all keep
working untouched. Reporting is the one place that gets a deliberate exclusion — see §4.

The declaration record still exists rather than being skipped, because it carries what a `TimeEntry`
cannot: the proof document, the one-number-per-month uniqueness constraint, and its own audit trail.

**Rules that follow:**

- `localDate = periodStart` (the 1st). It is never in the future for a month that can be declared,
  and it makes rate resolution deterministic.
- **Rate: the month-start rate applies to the whole declared figure.** `resolveTimesheetLineRate`
  resolves per `localDate`, so a figure sitting on the 1st bills entirely at the rate valid then. A
  declared total is a single aggregate that carries no information about _when_ within the month the
  work happened, so splitting it across mid-month rate periods would invent data. Decided; document
  it where rates are documented.
- Editing a declaration updates the same entry in place — never a second one.
- Deleting a declaration soft-deletes its entry (`deletedAt`), like any other entry.
- A declared assignment **may not** have ordinary time entries, and a tracked assignment may not have
  a declaration. Enforced server-side on both write paths; without it the month double-counts.

### Locking — no new mechanism

- **Contractor:** the declaration is locked exactly when its materialized entry is locked. Same
  `PeriodLock`, same `lockedByTimesheetRevisionId`, same unlock-for-correction path. Nothing new.
- **Employee:** verified there is no lock at all — `PeriodLock.timesheetId` is required and timesheets
  are contractor-only, so an employee can edit any past month today. Declared hours inherit exactly
  that: **editable indefinitely**, which is precisely the stated rule ("as long as normal time
  tracking is editable"). Decided, and recorded as an accepted asymmetry rather than an oversight. An
  employee-side month close is a separate feature, not a dependency of this one.

### Proof document

- One document per declared assignment per month, `DocumentType.HOURS_PROOF`, PDF only.
- **Mandatory for contractors:** submission is blocked while any declared assignment in the month has
  hours but no proof. A new `TimesheetSubmissionError` in `submit-timesheet.ts`, alongside the
  existing missing-description and missing-rate guards. Rationale: the proof is what replaces the
  per-day detail these projects don't have — without it there is nothing for an admin to check.
- **Employees have no submission gate**, so a missing proof surfaces as a warning on `/time` and in
  the admin review. That is the most the app can do without inventing an employee-side workflow.
- Upload follows the existing precedent: a Server Action into `ObjectStorage.put` with a per-type
  file validator, exactly like `uploadPayslip`. The 12 MB Server Action body limit applies and must
  produce a real error message, not a silent failure.
- Replaceable while the month is unlocked; view-only afterwards.

## 4. What a declared entry touches

A materialized entry of, say, 52h sitting on the 1st of a month is unlike anything currently in the
table. These are verified collisions in current code, not hypotheticals.

> **The boundary rule.** Declared hours belong to the **timesheet and invoice chain**, and not to the
> **reporting chain**.
>
> **In:** the submission snapshot and its totals, period locking, the contractor's monthly preview,
> and the admin review — where the hours, the proof and the invoice get compared.
>
> **Out:** reports, report exports, the report PDF, and the read-only MCP endpoint the domain model
> anticipates.
>
> Everything in this section follows from that one sentence.

**1 · Report line editing breaks.** `assertDailyTotals` in
`src/server/reports/report-line-persistence.ts:280` sums every non-deleted entry for a
(member, `localDate`) pair and throws `DAILY_LIMIT_EXCEEDED` above 24h.

The boundary rule already keeps declared lines out of the report editor, so nobody can edit one
there — but the collision survives anyway, in a narrower form: an admin editing a **tracked** line
dated the 1st of the month still has the declared 52h summed into that day's total, and the edit
fails for a reason nothing on screen explains. `assertDailyTotals` must therefore exclude
`source: DECLARED` from its own query, independently of the report filter.

**2 · Description is a submission precondition.** `submit-timesheet.ts:629` rejects any entry with an
empty description. The declaration's `note` is therefore not cosmetic — it is required for the month
to be submittable at all. That is why `note` is non-nullable in §3.

**3 · Every `/time` aggregate and warning would be poisoned.** `DAILY_SOFT_WARNING_MINUTES` (8h),
`DAILY_HARD_LIMIT_MINUTES` (24h), `getCellWarnings`, `getEntryWarnings`, `hasOverlaps`, and every day
and week total in `TimeGridClient` would absorb the figure.

> **Exclude at the query, not at the render.** `getMemberWeeklyTimeGrid` filters
> `source: DECLARED` out of `entries` entirely, and the month payload returns declarations
> separately. L1–L3 then literally cannot see a declared entry, so no downstream filter can be
> forgotten later.

**4 · Missing-hours flagging works, but on the wrong rhythm.** `deriveFlaggedUsers`
(`src/server/dashboard/dashboard.ts:366`) flags any assignment pair with no entry in the period and
no inactive-week marker. Once a declaration exists its materialized entry satisfies that check
unchanged — but a declared project is _expected_ to have nothing until the member declares near month
end, so a weekly flag would nag for three weeks out of four. Declared assignments must flag on a
monthly rhythm (nothing declared by month end), not a weekly one. Relatedly,
`InactiveProjectWeek` is meaningless for a declared assignment and must not be offered there.

**5 · Reports and exports exclude declared hours — in exactly one place.** Verified: reports read
**only** `TimeEntry` today (no snapshot-line path is implemented yet, despite the one the domain
model anticipates), and the query's `where` is assembled in a single exported function,
`buildReportTimeEntryWhere` (`reports.ts:407`), used from one call site (`reports.ts:319`). Adding
`source: { not: "DECLARED" }` there excludes declared hours from every report consumer at once: the
admin report UI, the Typst export, and — when it is built — the read-only MCP endpoint, provided it
uses the same builder rather than its own query.

Two consequences fall out for free. A declared figure can never be edited through the report line
editor, which is correct: a declared figure is corrected at L4, not in a report. And past exports are
unaffected, because `ReportExport.renderSnapshot` freezes its own JSON.

> **The risk this creates, and it is a real one.** A project with both tracked and declared members
> now reports _part_ of its hours. An admin reading "Atlas Platform — 94 h in September" has no way to
> know the number is incomplete. Excluding the hours is the decision; hiding the exclusion is not part
> of it.
>
> _Recommend_ a disclosure line in the report header and the PDF — "Excludes declared hours: 2
> members, 1 project" — stating the fact and no amounts. Also: a member whose assignments are all
> declared stays selectable in the report filters, since they may gain tracked work later, so the
> empty result needs an empty state that says _why_ rather than a blank table. See §17.

**6 · The admin review works for free — except the proof.** `AdminTimesheetReviewLine` is built from
`TimesheetSnapshotLine` (`sourceTimeEntryId`, `rateSource`, `hourlyRate`, `lineAmount`), grouped into
`AdminTimesheetReviewProject` with `totalMinutes` / `totalAmount`, and served beside
`AdminTimesheetReviewInvoice` for comparison. Because the declared figure is materialized, it becomes
a snapshot line and therefore appears in the review automatically — right project, right hours, right
resolved rate, counted into the very totals the invoice is checked against. This is the second,
independent justification for the materialization decision in §3.

What is missing is the proof. `AdminTimesheetReview` carries invoices and nothing else
document-shaped, so it needs:

- `AdminTimesheetReviewProject.trackingMode`, so a reviewer sees that a project's hours came from
  outside rather than inferring it from an `entryCount` of 1 — which otherwise reads as "this person
  logged one entry all month".
- `AdminTimesheetReviewProject.declaredProof` — document id, filename, content type, byte size,
  uploaded-at — viewed through the existing `DocumentPreview` / `PdfViewer` components and the same
  signed-URL access the invoice viewer already uses.
- A display rule for the line's `localDate`: a declared line is dated the 1st and should read as
  "September · declared", not "Sep 1", or a reviewer will take it for work done that day.

**A sanity bound, as a warning not a block.** A declared figure above 24h × days-in-month is
implausible. Surface it as a warning, consistent with how this app already treats over-24h, overlap
and future-date signals as data-quality warnings rather than database blocks
(`docs/domain-model.md`, Time Tracking).

## 5. The levels

Four stops. Direction: **L1 is zoomed in, L4 is zoomed out.**

|        | Level     | Coverage | Unit shown                | Primary job                                        | Editable                             |
| ------ | --------- | -------- | ------------------------- | -------------------------------------------------- | ------------------------------------ |
| **L1** | **Day**   | 1 day    | one entry, full detail    | read what I did, fix an entry                      | per-entry edit / delete              |
| **L2** | **Week**  | 7 days   | one entry, compact card   | _"what did I do this week?"_ — the missing level   | per-entry edit / delete, add per day |
| **L3** | **Grid**  | 7 days   | project × day aggregate   | bulk-fill a week fast                              | inline cell editing                  |
| **L4** | **Month** | 1 month  | project × month aggregate | close the month; the only home declared hours have | declared hours + proof               |

L1 and L3 exist today. **L2 and L4 are the new builds.**

Why L3 belongs on the axis rather than staying a separate mode: it is the same week's data at a
coarser resolution. Its inline editing is a property of that level, not a reason to fence it off. And
folding it in is what removes the mode switcher — the actual complaint being solved.

Why L4 is not a separate surface: a declared figure is month-scoped, and the axis's coarsest stop is
the only place in the product where month-scoped per-project data belongs. Putting it on its own
route would give a hybrid member two mental models for one month of work.

### Which stops a member gets

The stop list is **derived from the member's assignments**, not fixed:

| Member        | Stops                     | Opens on |
| ------------- | ------------------------- | -------- |
| Tracked only  | Day · Week · Grid · Month | Week     |
| Hybrid        | Day · Week · Grid · Month | Week     |
| Declared only | Month                     | Month    |

For a declared-only member the `SegmentedControl` is not rendered at all — a one-stop control is
noise. They get a monthly form and nothing else, which is the simple story the requirement asks for.
Month stays available to tracked-only members because a monthly overview is genuinely useful to
everyone, and it costs nothing extra once built.

## 6. The control

**Coarse moves — an explicit control.** `src/components/ui/SegmentedControl` already exists and takes
exactly the props needed (`items`, `value`, `onValueChange`, `label`, `size`). It replaces today's
hand-rolled two-button pill at `TimeGridClient.tsx:344-380`, and its `items` come from the derived
stop list in §5.

**Fine moves — direct manipulation, which is where the fluidity comes from:**

- L2 → L1: click a day column's header. You land on _that_ day.
- L3 → L2: click an aggregated cell. You land on the week with that day marked. The existing
  `BreakdownDialog` stays for "just show me this cell's entries" without moving.
- L4 → L3: click a tracked project row. Pure level change, not a filter — you land on the week the
  day strip is already pointing at.
- L1 → L2: the day strip is always present; clicking the current day's chip zooms out one stop.

**Keyboard:**

| Key                   | Action                                                    |
| --------------------- | --------------------------------------------------------- |
| `1` / `2` / `3` / `4` | jump to L1 / L2 / L3 / L4                                 |
| `−` / `+`             | step one level out / in                                   |
| `[` / `]`             | previous / next period — weeks at L1–L3, **months at L4** |
| `t`                   | this period, today                                        |

**Arrow keys are deliberately not claimed.** L3 is a spreadsheet, and arrow-key movement between
cells is the muscle memory anyone filling a week brings to it — today only the browser's default Tab
order works there, so that is a gap someone will want to close. Leaving the arrows free now costs
nothing; taking them for zoom and then wanting them for cells costs a redesign.

### Rejected: pinch / scroll-wheel zoom

Tempting, and wrong for this surface. It hijacks native scroll on a page that scrolls, it is
undiscoverable without a hint layer, trackpad pinch is inconsistent across browsers, and an
_accidental_ level change while someone is typing hours into a cell feels like data loss even when
nothing is lost. The brief was "látványos, de ne legyen zavaró" — this is the line.

## 7. The continuity contract

This is the heart of the feature. Fluidity is not the animation; it is **what survives the
transition**. The animation only makes the survival legible.

1. **The selected day always survives.** Zoom out from Wednesday → L2 marks Wednesday. Zoom back in →
   Wednesday, not today. Today's `selectedDayIso` (`TimeGridClient.tsx:163`) already holds this; it
   must not reset on a level change.
2. **The day strip is persistent chrome.** It renders at all four levels and never unmounts. At L4 it
   is de-emphasised and reads as _"the week you will return to"_ — which is also what makes zooming
   back in from the month deterministic.
   _Superseded by `docs/time-view-redesign.md` §5.4:_ the strip left the desktop Week scope, where
   the seven column headers already say everything it said, and became the Day scope's ribbon.
   What survives is stronger — the headers, chips and heat cells share one `layoutId`, so the day
   visibly goes somewhere — and the week you return to is the heat navigator's tinted row.
3. **Totals never remount.** Week total, day total and month total keep their DOM element across
   levels. The _number_ may change; the element does not move or fade.
4. **Focus survives.** If focus is on Thursday's chip, a level change leaves it there. A level change
   never dumps focus to `<body>`.
5. **Scroll intent survives.** Zooming L2 → L1 on a day scrolled out of view scrolls it into view
   rather than jumping to the top.
6. **Shared identity across levels.** The same conceptual object keeps one `layoutId`:
   `day-<iso>` (chip, column, grid column header), `entry-<id>` (row at L1, card at L2), and
   `project-<id>` (the colour dot + name, present at every level including the L4 bands).

## 8. The month level, and the hybrid story

L4 has a month header (label, month total, previous/next month) and **two bands**:

```
┌ Day ── Week ── Grid ──[Month]┐
└──────────────────────────────┘

  September 2026                    168 h
  MON TUE WED THU FRI SAT SUN     ← persistent, de-emphasised

  TRACKED IN SHEET HAPPENS
  ● Atlas Platform          94 h    ▸ zoom in
  ● Internal Ops & Tooling  22 h    ▸ zoom in

  DECLARED MONTHLY
  ● Nimbus  (external system)
      hours  [    52    ] h
      note   [ Platform migration support        ]
      proof  nimbus-sep.pdf   ✓ view   ↻ replace
```

Tracked band first — it is the app's primary mode. For a declared-only member the tracked band and
both band headings are dropped; they see one form.

### The hybrid handoff

When a hybrid member is at L1–L3, their declared projects are **absent** — and absence has to be
explained, or it reads as data loss. One line under the day strip, not a banner, because it is
information rather than a warning:

> _Nimbus is declared monthly — see Month_

The project name is a link that zooms to L4. Two or more declared projects collapse to a count with
the same link.

This is the whole hybrid answer: **zoom out to the month and you see everything you are responsible
for, both kinds side by side, each at the finest resolution it has. Zoom in and the declared rows
fall away, because there is nothing finer to show.**

### Admin configuration

The mode is set where assignments are already managed — `app/admin/projects` (`actions.ts`,
`AdminProjectsTable.tsx`), beside the assignment's existing `notes` and rate override. Two controls:
the member-level default, and the per-assignment override with an explicit "inherit" state so an
admin can see which assignments are deliberately different.

Switching an assignment's mode while the open month already holds data of the other kind must be
**blocked with an error naming what has to be removed first** — silently orphaning a month's entries
or a declaration is worse than refusing. See §17.

## 9. Motion design

### Library decision

Add **`motion`** (`pnpm add motion`) — the current package name; `framer-motion` is the legacy alias.
This is the one new runtime dependency the work introduces.

Why not hand-rolled CSS: the level transitions are **layout** animations between different DOM
structures — a full-width row becomes a narrow card in a column, then a band row. CSS cannot
interpolate that; it needs FLIP with per-frame measurement, which is precisely what Motion's
`layout` / `layoutId` projection does. Hand-rolling it is the classic way to end up with jank and a
scroll-position bug.

```tsx
// app/time/… — "use client" already applies
import { LazyMotion } from "motion/react";
import * as m from "motion/react-m";

const loadMotionFeatures = () => import("./motion-features").then((mod) => mod.default);

// motion-features.ts
export { domMax as default } from "motion/react";
```

`LazyMotion` + `m` keeps the feature bundle out of every other route — `/time` is the only consumer.
Note that **layout animations need `domMax`, not `domAnimation`** (`domAnimation` omits layout
projection and drag); verify the bundle contents when wiring it up. Use `strict` on `LazyMotion` so a
stray full `motion.*` import fails loudly instead of silently re-inflating the bundle.

### Reduced motion — required, not optional

The global CSS block at `app/globals.css:1377` sets `animation-duration` and `transition-duration` to
`0.01ms`. **It does not affect Motion**, which animates via JS/WAAPI outside CSS transitions. Without
explicit handling, this feature would be the one place in the app that ignores the user's OS setting.

`<MotionConfig reducedMotion="user">` at the `/time` client root. That setting disables transform and
layout animation while keeping opacity — exactly the right degradation: the level still crossfades,
nothing flies. Where a bespoke choice is needed, `useReducedMotion()` gates it.

### Motion tokens

`--ease-standard` is the only motion token today. This feature needs a small, named set — added to
`app/globals.css` and documented in `docs/tokens.md` alongside it:

| Token              | Value                                     | Used for                           |
| ------------------ | ----------------------------------------- | ---------------------------------- |
| `--ease-standard`  | existing `cubic-bezier(0.2, 0.7, 0.2, 1)` | the default for everything below   |
| `--ease-exit`      | `cubic-bezier(0.4, 0, 1, 1)`              | elements leaving                   |
| `--duration-level` | `260ms`                                   | a zoom-level transition            |
| `--duration-micro` | `140ms`                                   | hover, chip state, badge crossfade |
| `--duration-bar`   | `300ms`                                   | a capacity bar changing width      |
| `--stagger-entry`  | `18ms`                                    | entry cards entering               |

Motion reads these as literals in TS rather than CSS vars (it cannot interpolate a `var()`), so they
live in one `motion.ts` constants module mirroring the token values. The token table is the source of
truth; the module carries a comment saying so.

### Per-transition spec

**Level change (the headline moment), 260ms:**

- The day strip does not animate. It is the fixed point.
- Day columns / rows animate via `layout` + shared `layoutId` — a day's entry stack visibly _becomes_
  its column, rather than one list fading out while another fades in.
- Entering entry cards: `AnimatePresence`, opacity + 4px `y`, staggered by `--stagger-entry`.
- Exiting: opacity only, `--ease-exit`, no movement. Exits should be quick and unremarkable.
- **Declared rows entering at L4** use the same treatment as entry cards, and the L1–L3 handoff line
  crossfades in place — it must not slide, or it reads as an alert.
- `initial={false}` on the root so **nothing animates on first paint**. A page that flies in on load
  reads as cheap and delays first interaction.

**Numbers never tween.** Day, week and month totals and cell values crossfade or simply swap. A
rolling odometer on financial figures reads as imprecise, and these numbers feed timesheet revisions.
A deliberate restraint, not an omission. This applies with extra force to a declared figure the member
just typed.

**Stagger is capped.** A 40-entry week at 18ms each is 720ms of drizzle. Cap the staggered set (first
~8 per column) and render the rest immediately.

### Performance budget

- Animate **transform and opacity only**. No width/height/top/left tweens.
- **Do not put `layout` on grid cells.** L3 can be 10 projects × 7 days = 70 cells, and every
  `layout` participant costs a measure/projection pass per frame. Only the container, the seven day
  columns, the visible entry cards and the L4 band rows participate.
  **Target: ≤ 30 layout participants per transition.**
- 60fps on a mid-range laptop with a 40-entry week. If a transition can't hold that, cut the stagger
  before cutting the layout animation — the layout animation is what carries the meaning.

## 10. Layout per level, and mobile

**Desktop (≥ lg):**

- L1 — today's `DayView`, unchanged in substance.
- L2 — `grid-cols-7`; each column has a sticky day header (short label, day number, total, capacity
  bar), then entry cards, then a per-column add affordance. Columns scroll as one page, not
  independently — independent column scroll makes cross-day comparison impossible.
- L3 — today's grid, unchanged in substance.
- L4 — two stacked bands of full-width rows (§8). Rows, not cards: they are a list of like things,
  and one radius-and-shadow per row would flatten the hierarchy the bands create.

**Mobile.** Seven columns do not work on a phone, and this needs deciding up front rather than
patching later.

- L1 — as today.
- L2 — **accordion**, not columns: seven day sections, selected day expanded, others collapsed to one
  summary row (day, total, capacity bar). This is the focus+context degradation, and it is arguably
  _better_ than the desktop form for scanning a week.
- L3 — today's grid already has a separate mobile treatment; keep it.
- L4 — already a list of rows, so it needs only stacking within each row: hours, note and proof go
  vertical. This makes L4 the best mobile level in the product, which matters, because a
  declared-only member's entire interaction with the app is this one screen once a month.

The zoom control stays visible at all breakpoints; only what a level _renders_ changes.

## 11. State, URL, and what needs the server

Add two search params next to the existing `week`:

| Param  | Values                               | Notes                                                                                   |
| ------ | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `zoom` | `day` \| `week` \| `grid` \| `month` | absent → the remembered preference, else `week` (or `month` for a declared-only member) |
| `day`  | `YYYY-MM-DD`                         | absent → today if in range, else week start                                             |

**Write them with `history.replaceState`, not `router.push`.** `app/time/page.tsx` is
`force-dynamic`; a `router.push` on every zoom or day change would re-issue the page's database
queries for data the client already holds. `src/lib/use-overlay-param.ts` already establishes this
pattern and documents the reasoning — extend it or add a sibling hook rather than inventing a third
approach. `replaceState` also keeps Back meaning "previous period", not "previous zoom level", which
is the right mapping.

**Remembered preference:** last used level in `localStorage`, applied only when `?zoom=` is absent.
Read it in an effect to avoid a hydration mismatch; with `initial={false}` the settle is invisible.
This alone removes half the perceived "constant clicking".

### The month is derived from `day`, not from `week`

A week can span two months — the current screenshot's own week is **Aug 31 – Sep 6, 2026**. So "which
month am I in" must come from the selected day, never from the week. At L4, `[` / `]` therefore set
`day` to the 1st of the adjacent month and `week` to the week containing it.

### Keeping L4 reachable without a round-trip

L4 crossing a server boundary would break both the `replaceState` rule above and the pure layout
animation in §9 — a level change cannot show a spinner. It does not have to:

> **L4 needs no per-entry month data.** The tracked band is per-project sums; the declared band is
> declaration rows plus proof metadata. That is a small `groupBy` and one small `findMany`.

So the page ships the month payload alongside the week on every load, for **every month the visible
week touches** (one or two — bounded by the same Aug/Sep edge case above). Any `day` inside the
visible week then has its month already loaded, and all four stops are reachable with zero
round-trip. Moving to a _different_ month at L4 changes `week`, which is a real navigation and a
server fetch — the same as changing weeks today, and expected.

## 12. Architecture

The 95 KB single-file client is the main delivery risk. Neither new level goes into it.

```
prisma/
  time-tracking.prisma                    ← MonthlyHourDeclaration
  projects.prisma                         ← ProjectAssignment.trackingMode
  identity.prisma                         ← Member.defaultTrackingMode
  enums.prisma                            ← TrackingMode, EntrySource.DECLARED,
                                            DocumentType.HOURS_PROOF
src/server/reports/
  reports.ts                              ← buildReportTimeEntryWhere excludes source: DECLARED
  report-line-persistence.ts              ← assertDailyTotals ignores declared entries
src/server/timesheets/
  admin-review.ts                         ← review gains trackingMode + declaredProof per project
  submit-timesheet.ts                     ← the missing-proof submission guard
src/server/time-tracking/
  tracking-mode.ts                        ← resolveTrackingMode, the single authority
  declarations.ts                         ← declaration CRUD + materialization, one transaction
  month-overview.ts                       ← getMemberMonthOverview (per-project sums + declarations)
  time-entries.ts                         ← getMemberWeeklyTimeGrid excludes source: DECLARED
src/components/sheet/
  WeekAgenda/                             ← the L2 level, presentational
    WeekAgenda.tsx · .types.ts · .variants.ts · .stories.tsx · .test.tsx · index.ts
  MonthOverview/                          ← the L4 level: header + both bands
  DeclaredHoursRow/                       ← hours input + note + proof slot, own stories/tests
  DayAgenda/                              ← extracted from the local DayView
app/time/
  TimeZoomShell.tsx                       ← owns zoom state, day strip, MotionConfig/LazyMotion
  motion-features.ts                      ← the domMax dynamic-import boundary
  motion.ts                               ← duration/easing constants mirroring the tokens
  TimeGridClient.tsx                      ← shrinks: keeps mutations, modals, quick actions
```

Per `src/components/README.md`: presentational components take data + callbacks; server mutations and
optimistic state stay at screen level. `WeekAgenda` and `MonthOverview` therefore know nothing about
server actions — they report intent (`onSelectDay`, `onEditEntry`, `onAddEntry`, `onZoomToDay`,
`onDeclaredMinutesChange`, `onProofUpload`).

`DeclaredHoursRow` is its own folder rather than markup inside `MonthOverview` because it is a
repeated composed object with real behaviour — a parsed hours input, an upload with progress and
rejection states, and a locked variant — and that needs its own stories and tests.

**The orphaned library components.** `DayDetailPanel` and `WeeklyTimeGrid` are exported, stories'd,
visual-baselined — and unused by the real page. Building the new levels in the library and
_consuming them_ moves in the right direction, but leaves `DayDetailPanel` as a near-duplicate of the
extracted `DayAgenda`. Recommendation: **retire `DayDetailPanel`** as part of this work — the folder,
its export, and its visual baseline. It is dead code whose only cost today is confusion. That deletes
existing code, so it is an explicit decision (§17). `WeeklyTimeGrid` is a bigger reconciliation and
stays out of scope.

## 13. i18n scope

New keys in **both** `messages/hu.json` and `messages/en.json` — a feature is not done until both are
complete.

**The axis:**

- `TimeTracking.zoom.day` / `.week` / `.grid` / `.month` — level labels, replacing `TimeTracking.view.*`
- `TimeTracking.zoom.controlLabel` — the `SegmentedControl` accessible label
- `TimeTracking.zoom.announce` — the live-region string, e.g. `"Week view · {days} days · {total}"`
- `TimeTracking.zoom.zoomToDay` / `.zoomOut` — the direct-manipulation affordances
- `TimeTracking.zoom.keyboardHint` — discoverability for the shortcuts
- `TimeTracking.week.columnEmpty`, `TimeTracking.week.capacity`

**Declared hours:**

- `TimeTracking.month.trackedBand` / `.declaredBand` — the two band headings
- `TimeTracking.month.declaredElsewhere` — the L1–L3 handoff line, with a project name and a count form
- `TimeTracking.declared.hoursLabel` / `.noteLabel` / `.notePlaceholder`
- `TimeTracking.declared.proofLabel` / `.proofUpload` / `.proofReplace` / `.proofView` / `.proofMissing`
- `TimeTracking.declared.locked` — why the row is read-only
- `TimeTracking.declared.sanityWarning` — the implausible-figure warning
- Admin side: the mode labels, the inherit state, and the mode-switch refusal message
- Admin review: the declared-project marker, the proof viewer label, and the "September · declared"
  line-date form
- Reports: the disclosure line (a plural-aware member and project count) and the
  all-hours-are-declared empty state
- Submission errors: the missing-proof block, surfaced through the existing timesheet error path

All numbers and dates format through `src/lib/formatting` so `Intl` stays the single authority. Note
that a declaration's `note` is **stored**, not translated at render — it is copied verbatim into the
immutable snapshot and into the Typst PDF. That is why it is written by a human rather than generated
(§17).

## 14. Explicitly out of scope

Each of these is a real idea; none is needed to make this work, and each would double the surface.

- **Rolling N-day range** instead of the ISO week. The browsing range and the _submission_ range are
  genuinely separable — timesheets are monthly, the approvable cap is weekly — but decoupling them
  touches `getMemberWeeklyTimeGrid` and every total on the page. Follow-up.
- **An employee-side month close.** Verified there is no lock for employees today (§3). Adding one is
  its own feature touching `PeriodLock`, the admin surface and employee notifications — not a
  dependency of declared hours.
- **Drag & drop entries between days.** The most attractive addition to L2 and the natural next step —
  but it needs move/copy semantics, locked-day rejection and optimistic rollback. Separate work.
- **A clock-axis calendar.** Entries here are duration-first: `startTime` / `endTime` are nullable on
  `TimeGridEntry` and the entry modal's duration mode writes neither, so a clock axis would leave most
  entries in an "all-day" tray with the axis as decoration. Only worth it if timed entries become the
  norm.
- **Command palette / natural-language quick add.** Strong idea, unrelated to the axis. `cmdk` is
  already a dependency, so it is cheap later.
- **Per-member target hours.** Verified against `prisma/*.prisma`: no target, budget or expected-hours
  field exists anywhere in the schema. (`NotificationPreference.weeklyHoursReminder` is a boolean
  toggle with no threshold behind it, and no application code reads it.) v1's capacity bars therefore
  use the existing `DAILY_SOFT_WARNING_MINUTES` (8h) as the implicit daily target — no new domain
  state. Real per-member targets stay a schema decision.
- **Splitting a declared figure across mid-month rate periods.** Decided against in §3: the figure
  carries no information about when the work happened.
- **Parsing or validating the proof document.** We do not need to know which system it came from —
  that was explicit in the requirement. Store it, show it, let a human read it.
- **Pinch / scroll zoom.** Rejected on merit, see §6.

## 15. Accessibility scope

- The level control is a real `SegmentedControl` with a translated `label`.
- A level change announces via `aria-live="polite"` — a sighted user sees the transition; a screen
  reader user must be told.
- L2 columns get real semantics: a heading per day and a list per column, not a grid of `div`s. L3
  today is a CSS grid of unlabelled `div`s and bare `<input>`s with no header association — a screen
  reader user gets almost no context per cell. Do not reproduce that in the new levels.
- L4's bands are real headed regions, and each declared row's hours input has a real label naming its
  project — `"Nimbus, declared hours"`, not `"Hours"`.
- The proof upload has a keyboard-reachable trigger, not drag-and-drop only, and announces success,
  rejection and the locked state.
- Focus is preserved across level changes (continuity contract #4).
- `MotionConfig reducedMotion="user"` (§9). Verify with the OS setting on, not just in DevTools.
- Keyboard shortcuts must not fire while a text input or textarea has focus — which now includes the
  declared hours and note fields.
- Focus treatment: the `:focus-visible` rule must stay in `@layer base` — new interactive surfaces
  inherit the app's two focus treatments rather than inventing a third.

## 16. Testing scope

| Gate                      | What                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vitest — axis**         | level ↔ URL sync; the continuity contract (selected day survives every transition, both directions); the month-from-`day` rule across a month-spanning week; capacity/total math; keyboard shortcuts ignored while typing                                                                         |
| **Vitest — modes**        | `resolveTrackingMode` inheritance and override; declaration create/update materializes exactly one entry; the uniqueness constraint; declared entries excluded from `getMemberWeeklyTimeGrid`; the mode-switch refusal                                                                            |
| **Vitest — collisions**   | one test per item in §4: `assertDailyTotals` ignores declared entries even while editing a tracked line on the same date; submission blocks on a missing proof; submission succeeds with a declared-only month; flagging uses the monthly rhythm                                                  |
| **Vitest — the boundary** | `buildReportTimeEntryWhere` excludes declared entries, so a report over a hybrid project returns only tracked hours; the admin review over that same month returns the declared line, its total and its proof. These two are the feature's contract and deserve to be asserted next to each other |
| **Vitest — money**        | month-start rate applied to the whole declared figure, including a mid-month rate change; the declared line appears in the snapshot with the right amount                                                                                                                                         |
| **Storybook**             | `WeekAgenda`: empty / typical / dense (40+ entries) / locked week, warnings, dark + light, mobile accordion. `MonthOverview`: tracked-only, declared-only, hybrid, locked month. `DeclaredHoursRow`: empty, filled, proof missing, proof uploaded, upload rejected, locked                        |
| **play test**             | click a day header at L2 → lands on L1 with that day selected; click a tracked row at L4 → lands on L3                                                                                                                                                                                            |
| **Visual**                | new baselines per level × theme × viewport, plus the three L4 member shapes. Capture with animations disabled so a mid-transition frame can never land in a baseline                                                                                                                              |
| **e2e**                   | `/time` has no spec today. Worth adding two: the zoom flow, and a declared-only member's monthly submission including the proof upload. Scoped as a stretch item, not a blocker                                                                                                                   |
| **QA plan**               | append scenarios to `docs/manual-qa-test-plan.md`, committed separately as `docs(qa): …` per repo convention. Cover the hybrid member explicitly — it is the case most likely to be got wrong                                                                                                     |

Note: `pnpm verify` currently stops early on a flaky Storybook test (`NotificationButton > Unread`),
which lands _before_ the visual and e2e steps. Expect to work around that when running the full chain.

## 17. Open decisions

Recommendations included. The four already settled — Month as the fourth stop, proof mandatory for
contractors, employee declarations editable indefinitely, month-start rate for the whole figure — are
written into §3, §5 and §8 rather than repeated here.

1. **Default level for a member with no stored preference.** _Recommend `week`_ for anyone with
   tracked assignments, and `month` (forced) for a declared-only member. Counter-argument: `grid` is
   fastest for bulk entry, and existing members are used to it opening there.
2. **Retire `DayDetailPanel`?** _Recommend yes_ — unused, and `DayAgenda` replaces it. Deletes code
   and a visual baseline, so it should be a conscious call.
3. **Does L3 stay inline-editable at its zoom stop?** _Recommend yes_ — removing it would be a
   regression in bulk-entry speed.
4. **Capacity bars in v1?** _Recommend yes, using the existing 8h soft-warning constant._ The honest
   caveat is that 8h is an assumption, not a per-member target.
5. **Is the declaration's `note` written by the member, or generated?** _Recommend member-written and
   required._ It is copied verbatim into the immutable snapshot and the Typst PDF, and there is no
   render-time translation — so a generated string would need a language chosen at write time and
   would read as filler in admin reports. A short "what did you work on this month" is better data and
   removes the problem. The open part: whether an **admin**-created declaration needs a generated
   fallback, and in which language.
6. **Mode switch with existing data.** _Recommend refusing the switch_ with an error naming what must
   be removed first. Alternatives: allow it and orphan the data, or auto-delete — both worse.
7. **Can an admin enter or correct a declared figure on the member's behalf?** _Recommend yes,
   mirroring the existing entry path_ — `TimeEntry` already carries `adminModifiedAt` /
   `adminModifiedByMemberId` / `adminModificationReason` and there is a `TIME_ENTRY_ADMIN_MODIFIED`
   notification, so the pattern and the audit trail already exist. The declaration record should carry
   the same fields.
8. **Does a report disclose that it excluded declared hours?** _Recommend yes_ — a header and PDF
   line naming how many members and projects were omitted, with no amounts (§4). The argument against
   is `ReportMode.COST_FREE`, whose whole purpose is to strip internal detail; if a cost-free export
   is ever handed outside the company, the wording has to survive that read. A narrower alternative
   is to disclose only in `INTERNAL` mode.
9. **Ship the two tracks separately?** _Recommend yes_ — see §18.

## 18. Phasing

Two tracks. **A** is the axis; **B** is tracking modes. B depends on A only through L4, so the tracks
can run in either order or in parallel — and if declared hours are the more urgent business need, B
can start as soon as A0 lands.

| Phase  | Content                                                                                                                                                                                                               | Ships value alone                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **A0** | `zoom` + `day` search params, remembered preference, `SegmentedControl` swap, keyboard shortcuts. **No new level, no motion.**                                                                                        | Yes — the view survives a reload and is linkable             |
| **A1** | `WeekAgenda` (L2) + types/variants/stories/tests; extract `DayAgenda`; wire the middle stop. **Still no motion.**                                                                                                     | Yes — the itemized week, the original ask                    |
| **A2** | `motion` dependency, motion tokens, layout transitions, the continuity contract, `MotionConfig reducedMotion`                                                                                                         | Yes — the fluidity                                           |
| **A3** | Capacity bars, live-region announcements, a11y semantics, mobile accordion polish                                                                                                                                     | Yes                                                          |
| **B0** | Schema: `TrackingMode`, `MonthlyHourDeclaration`, the new enum values. `resolveTrackingMode`. Admin configuration UI. **No member-facing change.**                                                                    | Yes — admins can classify people before anything else exists |
| **B1** | L4 `MonthOverview` with the **tracked band only**, plus the month payload in §11. Depends on A0.                                                                                                                      | Yes — a monthly overview for everyone                        |
| **B2** | Declared hours + proof upload at L4, the declared band, the L1–L3 handoff line, the derived stop list, and every fix in §4 — the report exclusion, the admin review's proof and mode marker, and the submission guard | Yes — the feature                                            |
| **C**  | Visual baselines, i18n completeness sweep, QA plan scenarios, optional e2e                                                                                                                                            | Closes both tracks                                           |

A1 is the original feature. A2 is what makes it feel like the product described. B2 is the new one.
A0, A3 and the §4 fixes in B2 are the parts that are easy to skip and expensive to retrofit.

## 19. Housekeeping

**Already authorised.** Two things `CLAUDE.md` requires asking about first were proposed and accepted
in the discussion that produced this document: adding **`motion`** as a new runtime dependency, and
the **migration** for the schema changes in §3. Nothing else new is authorised — a third dependency,
a new top-level directory, or a second migration still needs asking.

**Prisma.** The schema is split across `prisma/*.prisma`, and §3's changes land in four of those
files, not one. Run `pnpm db:generate` after the schema edits. Never run `pnpm db:migrate:deploy`
against anything but a local database.

**Git.** Each phase in §18 takes its own branch off `develop`, created with
`git switch -c <name> --no-track origin/develop`. Never commit on `develop` or `main`, and never
push — `git push` is blocked by a deny rule, and the push and PR are the developer's to make.

**Line numbers in this document are accurate as of the commit that introduced it and will drift as
soon as implementation starts.** Treat every `file.ts:123` reference as a pointer to a _symbol_ —
`buildReportTimeEntryWhere`, `assertDailyTotals`, `deriveFlaggedUsers`, `selectedDayIso` — and grep
for that symbol rather than trusting the line. The file paths and symbol names are the durable part.
