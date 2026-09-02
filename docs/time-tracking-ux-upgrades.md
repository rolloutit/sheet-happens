# Time Tracking UX Research & Upgrade Ideas

Research pass over `/time` (`app/time/TimeGridClient.tsx`, `TimerCreateDialog.tsx`) compared against
current, widely-used time trackers: **Toggl Track**, **Clockify**, **Harvest**, and **Timely**, plus
general 2026 time-tracking UX round-ups. Every idea below is checked against what the code and
`docs/domain-model.md` actually do today — nothing here assumes a feature or field that doesn't
exist yet (flagged explicitly where it would need one).

Each item has:

- **Effort** — S (small, UI-only) / M (medium, some logic) / L (large) / XL (new product surface)
- **Impact** — how much it moves user-friendliness for this app specifically
- **Reason** — why, in one or two sentences
- **Inspired by** — which app(s) popularized the pattern, for reference

## Today, at a glance

For context: `/time` already has a **Weekly grid** (projects × days, inline-editable cells, flexible
duration text like `3h 20m`) and a **Day view** (chronological entry list), a duration-vs-interval
entry modal with server-persisted draft autosave, a single-running-timer feature shown as a card on
the page and a pill in the header everywhere else, "same as yesterday" / "duplicate last week" quick
actions, inactive-project-week marking, soft (8h) and hard (24h) daily warnings, overlap detection,
and locked/read-only periods once a month is submitted. This is a genuinely solid baseline — the
list below is about closing specific, real gaps against what Toggl/Clockify/Harvest users expect,
not a rebuild.

---

## A. Quick wins — improve what's already there

**A1. Spreadsheet-style keyboard navigation in the grid** (Effort: S/M · Impact: High)
Arrow keys move focus between cells, Enter commits and steps down a row, like a spreadsheet.
*Reason:* the grid already looks and behaves like a spreadsheet, but today only the browser's default
Tab order works — there's no arrow-key movement between cells (`TimeGridCell` only handles `Enter` to
blur). Anyone filling a full week leans on this muscle memory. *Inspired by:* Harvest, Google
Sheets-style grids.

**A2. Undo-able delete** (Effort: S · Impact: High)
Show a brief "Entry deleted · Undo" toast instead of deleting immediately.
*Reason:* `deleteTimeEntryAction` currently fires with no confirmation and no way back — a misclick on
the trash icon (Day view, breakdown dialog, or an emptied grid cell) permanently loses a logged entry.
*Inspired by:* Toggl Track, Clockify (both use a short-lived undo snackbar for deletes).

**A3. One-click "Continue" / duplicate a single entry** (Effort: S/M · Impact: High)
A "repeat this" action on any single entry — copy it to another day, or restart a timer with the same
project + description.
*Reason:* today the only copy tools are whole-day ("same as yesterday") or whole-week ("duplicate last
week"); there's no way to repeat just one entry from Tuesday onto Thursday. This is one of the
single most-used actions in competing apps. *Inspired by:* Toggl Track's "Continue" play button next
to any past entry.

**A4. Description autocomplete from history** (Effort: M · Impact: High)
Suggest the member's own recent descriptions (scoped to the selected project) while typing in the
entry modal.
*Reason:* `description` is currently a bare `<textarea>` with no memory of anything typed before.
Autocomplete both speeds up entry and nudges consistent wording, which matters since description text
ends up in reports and invoice line detail. *Inspired by:* Toggl Track, Clockify, TMetric.

**A5. Make overlaps visible, not just flagged** (Effort: M · Impact: Medium)
A compact hour-by-hour strip in Day view showing entries as blocks, so overlapping times are visibly
stacked instead of only triggering a warning triangle.
*Reason:* `entryHasOverlap`/`hasOverlaps` already compute this correctly — it's purely a presentation
gap. Seeing the overlap beats reading "this entry overlaps another." *Inspired by:* Clockify and
Toggl's calendar/timeline views.

**A6. Paste a row of hours from a spreadsheet** (Effort: M · Impact: Medium)
Support pasting a tab- or comma-separated set of numbers into a project's week row, filling multiple
day cells at once.
*Reason:* grid cells commit one at a time on blur; contractors who track hours in a personal
spreadsheet first currently have to retype every cell by hand. A common Excel habit that costs nothing
to support since duration parsing already exists (`parseDurationToMinutes`).

**A7. Global single-key timer shortcuts** (Effort: S · Impact: Medium)
`S` to stop the running timer, `N` for a new timer, `C` to continue the last entry — active anywhere
on `/time`, not just while a field is focused.
*Reason:* right now starting/stopping a timer always needs a mouse trip to `RunningTimerCard` or
`TimerCreateDialog`. This is one of the most-used affordances in Toggl Track (`S`/`N`/`M`/`C`), and it's
pure client-side logic with no new UI surface. *Inspired by:* Toggl Track's webapp shortcuts.

---

## B. Design / UI polish

**B1. Move the entry modal onto the shared Drawer/FormDrawer shell** (Effort: M · Impact: Medium — consistency)
`EntryModal` and `BreakdownDialog` in `TimeGridClient.tsx` hand-roll their own `fixed inset-0` overlay
and a ~70-line custom focus trap (`useModalFocusTrap`). The admin section has already standardized on
`src/components/sheet/FormDrawer` for exactly this "create/edit with unsaved state" shape (see
`InviteMemberDrawer`, `ProjectCreateDrawer`) — it already solves the dirty/discard-guard problem this
modal reinvents. Time entry is the last screen still doing this from scratch; moving it in gets a
side-drawer presentation (friendlier on mobile) essentially for free.

**B2. Row density toggle for the grid** (Effort: S · Impact: Medium)
A "comfortable / compact" density switch for grid rows.
*Reason:* this app's own component conventions (per `CLAUDE.md`) call for a `density` variant on
exactly this kind of table, and today every project row is a fixed `min-h-14` regardless of how many
projects a member is assigned to — a contractor on 8+ projects gets a long, all-scrolling grid with no
way to see more at once.

**B3. A week-target / completion bar next to Week Total** (Effort: S · Impact: Medium)
A slim progress bar toward a target weekly hours number, shown alongside the existing week total.
*Reason:* right now the only feedback on total hours is a warning color once a day crosses 8h — there's
no positive framing of "on track for the week." *Inspired by:* Clockify and actiTIME both show weekly
capacity this way. (Needs a target-hours value from somewhere — a member or assignment setting; not
inventing new domain state here, just flagging the dependency.)

**B4. Consistent color/icon for timer-sourced entries** (Effort: S · Impact: Low/Medium)
`formatEntrySource` already labels entries "Grid" / "Form" / "Timer" as plain pill text; give the
"Timer" badge the same accent as the running-timer's pulsing dot so a busy day is scannable at a
glance for "this was live-tracked" vs. "typed in after the fact."

**B5. Sticky totals bar on mobile scroll** (Effort: S · Impact: Low)
Keep "Day total" and a floating "+ Add entry" visible while scrolling a long Day-view entry list,
instead of only at the top of the page. Common in mobile-first trackers (Toggl, ClickUp).

**B6. Keyboard- and screen-reader-navigable grid semantics** (Effort: M · Impact: Medium)
Give the weekly grid real table semantics (row/column headers announced per cell) so a screen reader
user hears "Tuesday, Website Redesign, 3h 20m" instead of an unlabeled text input, and so Home/End/
Page-Up/Down work the way they do in a spreadsheet.
*Reason:* the grid is currently a table of bare `<input>`s with no header association — it works by
mouse/Tab but gives a screen-reader user almost no context per cell. This pairs naturally with A1
(arrow-key nav uses the same semantics) and is the kind of gap that's invisible until someone relies on
assistive tech. *Inspired by:* WCAG data-table guidance, not any single competitor.

---

## C. New functionality

**C1. Idle-time / forgotten-timer detection** (Effort: L · Impact: High)
Prompt the user when a running timer has been going unusually long: "You've been away — keep this
time or discard it?"
*Reason:* `RunningTimerCard` just counts up indefinitely today; the only existing safety net is the
blunt one at the 24h hard limit (per the QA plan's "Timer Discarded At The Daily Limit" scenario). A
proactive idle check is the difference between catching a forgotten timer at lunch versus at midnight.
*Inspired by:* Toggl Track's idle-detection prompt, effectively the industry-standard version of this.

**C2. "Continue" list on the timer** (Effort: M · Impact: High)
Show the last few distinct (project, description) combinations as one-click restart options, both in
the `New timer` dialog and the header pill.
*Reason:* pairs with A3 but as a first-class timer feature — today `TimerCreateDialog` only offers
"recent projects," not recent full entries, so restarting the exact same task requires retyping the
description every time. *Inspired by:* Toggl Track Favorites/Continue.

**C3. Calendar/timeline Day view** (Effort: L · Impact: High, aspirational)
A visual timeline (hours on one axis, entries as blocks) as an alternative to the current chronological
list.
*Reason:* turns "does this overlap?" into something you see instead of a warning message, and gives a
much clearer sense of gaps in the day. Could ship read-only first (visualize existing entries) before
ever considering drag-to-create. *Inspired by:* Clockify's and Toggl's calendar views.

**C4. Lightweight tags on top of project** (Effort: M/L · needs a product + schema decision · Impact: Medium)
A free-form or fixed-vocabulary tag per entry, separate from project.
*Reason:* `docs/domain-model.md` deliberately keeps the model flat (member → project → time entry, no
task layer). A tag is a much smaller addition than a task hierarchy and mirrors how Toggl/Clockify let
teams slice reporting (e.g. "billable", "on-site", "R&D") without restructuring projects. Flagging this
as a product call, not just a UI change — it touches the schema and reports.

**C5. Calendar-suggested entries (Google/Outlook)** (Effort: L · Impact: Medium)
Pull the member's calendar events in as one-click-accept suggested time entries ("You had 'Client sync'
10–11am — log it?").
*Reason:* the single most-cited "reduces the pain of remembering what I did" feature across every app
reviewed (Harvest, Clockify both do this). A real integration project, not a quick add.

**C6. Reminders to log time / submit** (Effort: M · Impact: Medium)
A nudge for a member who hasn't logged hours in a day or two, or who's approaching the monthly
submission deadline.
*Reason:* nothing today proactively reminds anyone — it's fully pull-based. Harvest and Clockify both
ship end-of-day/week reminder notifications; this could ride on whatever notification/email
infrastructure already exists for invites.

---

## D. Bigger bets (need a product decision before any UI work)

**D1. Per-project budget with a consumption bar** (Effort: L · Impact: High for teams tracking profitability)
A "32/40h used this month" bar under each project row, turning warm/red near the cap.
*Reason:* this is Harvest's most-loved feature, but it genuinely doesn't exist here yet — checked
`prisma/projects.prisma`, and `Project` has no target/budget field today. This needs an admin-side
"target hours" setting (monthly, to match the timesheet cadence) before the time page could show
anything — a real feature, not a display tweak.

**D2. Automatic/passive time capture** (Effort: XL · Impact: High but high-risk)
Background capture of app/window/meeting activity, clustered into suggested entries the user confirms.
*Reason:* Timely's "AutoSheet" (AI-drafted timesheets from passively captured "memories") is the most
differentiated idea among everything reviewed — but it's a different product surface entirely (a
desktop background agent, consent/privacy design, ML clustering). Worth knowing this exists; not a
near-term roadmap item.

---

## What not to copy (constraints specific to this app)

- **Immutable submitted revisions.** Any new "edit in place" affordance (calendar drag-resize, bulk
  edit) must hard-stop at `locked`/submitted periods, same as every existing entry-level control
  already does. Don't let a fancier UI accidentally imply it can touch a submitted month.
- **One running timer per member is deliberate**, not a limitation to fix — skip competitor features
  built around multiple simultaneous timers or team timer dashboards.
- **Single-tenant, internal app, no client portal.** Ignore agency-facing features aimed at billing
  multiple external clients (client login portals, white-labelled outbound invoices) — this app's own
  contractor-invoice flow already covers that need differently.

---

## If you only do a few of these

Best effort-to-impact ratio, in order: **A2** (undo delete) → **A3** (continue/duplicate a single
entry) → **A1** (keyboard navigation) → **C2** (continue list on the timer). All four are UI/logic-only
— no schema changes, no new product surface — and each addresses a real, observable gap rather than a
speculative one.
