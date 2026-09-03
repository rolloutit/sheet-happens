# Time View Zoom Axis — Scope

**Status:** proposal · scope under discussion
**Surface:** `/time` (`app/time/page.tsx`, `app/time/TimeGridClient.tsx`)
**Relationship to other docs:** read `docs/domain-model.md` before touching entry or lock logic, and
`docs/tokens.md` before adding the motion tokens in §6.

---

## 1. The idea

Replace the `Weekly grid` / `Day` mode toggle with **one continuous resolution axis**. Instead of
choosing a _mode_, the member chooses _how close they are standing_ to the same week of data.

Semantic zoom is the established pattern for this (Figma, Google Maps, Linear's roadmap, Fantastical's
day-count continuum): one control, monotonic behaviour, no filter clicking. The reason it fits here is
that `/time` already has both ends of the axis built — it just presents them as two unrelated screens
with a hard cut between them.

**The invariant that makes it read as one axis:** as you zoom out, _coverage grows and detail per item
shrinks_ — monotonically, at every step. Nothing else about the surface changes.

## 2. Where we are today

Grounded in the current code, because the scope depends on it:

| Fact                                                                                                               | Where                                                                           |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| The page already loads the **whole week** server-side — every entry, not just the selected day                     | `app/time/page.tsx` → `getMemberWeeklyTimeGrid`, returns `TimeGridWeek.entries` |
| The day view filters that same array client-side                                                                   | `TimeGridClient.tsx:195-197`                                                    |
| View mode is **local state**, lost on reload; only `?week=` is in the URL                                          | `TimeGridClient.tsx:162`                                                        |
| The real day view is a **local** `DayView`, ~200 lines inside the client file                                      | `TimeGridClient.tsx:1279`                                                       |
| The real grid is **inline JSX** in the same file                                                                   | `TimeGridClient.tsx:643+`                                                       |
| `TimeGridClient.tsx` is ~2560 lines / 95 KB in one file                                                            | —                                                                               |
| The library's `DayDetailPanel` and `WeeklyTimeGrid` are exported and Storybook-covered but **not used by `/time`** | `src/components/sheet/index.ts:33,224`                                          |
| Daily thresholds exist: 8h soft warning, 24h hard limit                                                            | `src/lib/time-entry-limits.ts`                                                  |
| A 32h/week approvable cap exists, but only inside the unused library grid                                          | `WeeklyTimeGrid.tsx` `MAX_APPROVABLE_MINUTES`                                   |
| One motion token exists: `--ease-standard: cubic-bezier(0.2, 0.7, 0.2, 1)`                                         | `app/globals.css:433`, `docs/tokens.md:271`                                     |
| A global `prefers-reduced-motion` block kills CSS animation/transition durations                                   | `app/globals.css:1377`                                                          |
| No `motion` / `framer-motion` dependency yet                                                                       | `package.json`                                                                  |
| No CSP is set, so Motion needs no `nonce`                                                                          | `next.config.ts`                                                                |
| `/time` has **no e2e spec** — only `home.spec.ts` and `theme.spec.ts` exist                                        | `e2e/`                                                                          |

**Consequence for scope:** the new middle level needs _zero_ new server work and _zero_ new queries.
This is a client-side layout, state and motion project.

## 3. The levels

Three stops. Direction: **L1 is zoomed in, L3 is zoomed out.**

|        | Level    | Coverage | Unit shown              | Primary job                                      | Editable                           |
| ------ | -------- | -------- | ----------------------- | ------------------------------------------------ | ---------------------------------- |
| **L1** | **Day**  | 1 day    | one entry, full detail  | read what I did, fix an entry                    | per-entry edit/delete              |
| **L2** | **Week** | 7 days   | one entry, compact card | _"what did I do this week?"_ — the missing level | per-entry edit/delete, add per day |
| **L3** | **Grid** | 7 days   | project × day aggregate | bulk-fill a week fast                            | inline cell editing                |

L1 and L3 exist today. **L2 is the new build.** It is the itemized week: 7 day columns, each a stack
of entry cards — no clock axis (see §11), height driven by content.

Why L3 belongs on the axis rather than staying a separate mode: it is the _same week's data at a
coarser resolution_. Its inline editing is a property of that level, not a reason to fence it off. And
folding it in is what removes the mode switcher — which is the actual complaint being solved.

## 4. The control

**Coarse moves — an explicit 3-stop control.** `src/components/ui/SegmentedControl` already exists and
takes exactly the props needed (`items`, `value`, `onValueChange`, `label`, `size`). It replaces
today's hand-rolled two-button pill at `TimeGridClient.tsx:344-380`.

**Fine moves — direct manipulation, which is where the fluidity comes from:**

- L2 → L1: click a day column's header. You land on _that_ day.
- L3 → L2: click an aggregated cell. You land on the week with that day marked. (The existing
  `BreakdownDialog` stays for "just show me this cell's entries" without moving.)
- L1 → L2: the day strip is always present; clicking the current day's chip zooms out one stop.

**Keyboard:**

| Key             | Action                  |
| --------------- | ----------------------- |
| `1` / `2` / `3` | jump to L1 / L2 / L3    |
| `-` / `+`       | step one level out / in |
| `[` / `]`       | previous / next week    |
| `t`             | this week, today        |

Arrow keys are **deliberately not claimed.** L3 is a spreadsheet, and arrow-key movement between
cells is the muscle memory anyone filling a week brings to it — today only the browser's default Tab
order works there, so that is a gap someone will want to close. Leaving the arrows free now costs
nothing; taking them for zoom and then wanting them for cells costs a redesign.

### Rejected: pinch / scroll-wheel zoom

Tempting, and wrong for this surface. It hijacks native scroll on a page that scrolls, it is
undiscoverable without a hint layer, trackpad pinch is inconsistent across browsers, and an
_accidental_ level change while someone is typing hours into a cell feels like data loss even when
nothing is lost. The brief was "látványos, de ne legyen zavaró" — this is the line.

## 5. The continuity contract

This is the heart of the feature. Fluidity is not the animation; it is **what survives the
transition**. The animation only makes the survival legible.

1. **The selected day always survives.** Zoom out from Wednesday → L2 marks Wednesday. Zoom back in →
   Wednesday, not today. Today's `selectedDayIso` (`TimeGridClient.tsx:163`) already holds this; it
   must not reset on a level change.
2. **The day strip is persistent chrome.** It renders at all three levels and never unmounts. It is
   the visual anchor the eye holds onto while everything else re-lays out.
3. **Totals never remount.** Week total and day total keep their DOM element across levels. The
   _number_ may change; the element does not move or fade.
4. **Focus survives.** If focus is on Thursday's chip, a level change leaves it there. A level change
   never dumps focus to `<body>`.
5. **Scroll intent survives.** Zooming L2 → L1 on a day that was scrolled out of view scrolls it into
   view rather than jumping to the top.
6. **Shared identity across levels.** The same conceptual object keeps one `layoutId`:
   - `day-<iso>` — a day chip, a day column, a grid column header
   - `entry-<id>` — an entry row (L1) and its card (L2)
   - `project-<id>` — the colour dot + name, which appears at all three levels

## 6. Motion design

### Library decision

Add **`motion`** (`pnpm add motion`) — the current package name; `framer-motion` is the legacy alias.
This is the one new runtime dependency this work introduces.

Why not hand-rolled CSS: the L1↔L2↔L3 transitions are **layout** animations between different DOM
structures (a full-width row becomes a narrow card in a column). CSS cannot interpolate that; it needs
FLIP with per-frame measurement, which is precisely what Motion's `layout` / `layoutId` projection
does. Hand-rolling it is the classic way to end up with jank and a scroll-position bug.

**Loading:**

```tsx
// app/time/... — "use client" already applies
import { LazyMotion } from "motion/react";
import * as m from "motion/react-m";

const loadMotionFeatures = () => import("./motion-features").then((mod) => mod.default);
// motion-features.ts: export { domMax as default } from "motion/react";
```

`LazyMotion` + `m` keeps the feature bundle out of every other route — `/time` is the only consumer.
Note that **layout animations need `domMax`, not `domAnimation`** (`domAnimation` omits layout
projection and drag); verify the bundle contents when wiring it up. Use `strict` on `LazyMotion` so a
stray full `motion.*` import fails loudly instead of silently re-inflating the bundle.

### Reduced motion — required, not optional

The global CSS block at `app/globals.css:1377` sets `animation-duration` and `transition-duration` to
`0.01ms`. **It does not affect Motion**, which animates via JS/WAAPI outside CSS transitions. So
without explicit handling, this feature would be the one place in the app that ignores the user's OS
setting.

```tsx
<MotionConfig reducedMotion="user">
```

at the `/time` client root. `reducedMotion="user"` disables transform and layout animation while
keeping opacity — which is exactly the right degradation here: the level still crossfades, nothing
flies. Where a bespoke choice is needed, `useReducedMotion()` gates it.

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
live in one `motion.ts` constants module that mirrors the token values. The token table is the source
of truth; the module carries a comment saying so.

### Per-transition spec

**Level change (the headline moment), 260ms:**

- The day strip does not animate. It is the fixed point.
- Day columns / rows animate via `layout` + shared `layoutId` — a day's entry stack visibly _becomes_
  its column, rather than one list fading out while another fades in.
- Entering entry cards: `AnimatePresence`, opacity + 4px `y`, staggered by `--stagger-entry`.
- Exiting: opacity only, `--ease-exit`, no movement. Exits should be quick and unremarkable.
- `initial={false}` on the root so **nothing animates on first paint**. A page that flies in on load
  reads as cheap and delays first interaction.

**Numbers never tween.** Day totals, week totals, cell values crossfade or simply swap. A rolling
odometer on financial figures reads as imprecise, and these numbers feed timesheet revisions. This is
a deliberate restraint, not an omission.

**Stagger is capped.** A 40-entry week at 18ms each is 720ms of drizzle. Cap the staggered set (first
~8 per column) and render the rest immediately.

### Performance budget

- Animate **transform and opacity only**. No width/height/top/left tweens.
- **Do not put `layout` on grid cells.** L3 can be 10 projects × 7 days = 70 cells, and every
  `layout` participant costs a measure/projection pass per frame. Only the container, the 7 day
  columns, and the visible entry cards participate. **Target: ≤ 30 layout participants per
  transition.**
- Budget: 60fps on a mid-range laptop with a 40-entry week. If a transition can't hold that, cut the
  stagger before cutting the layout animation — the layout animation is what carries the meaning.

## 7. Layout per level, and mobile

**Desktop (≥ lg):**

- L1 — today's `DayView`, unchanged in substance.
- L2 — `grid-cols-7`, each column: sticky day header (short label, day number, total, capacity bar),
  then entry cards, then a per-column "add" affordance. Columns scroll as one page, not
  independently — independent column scroll makes cross-day comparison impossible.
- L3 — today's grid, unchanged in substance.

**Mobile:** 7 columns do not work on a phone, and this needs deciding up front rather than patched
later.

- L1 — as today.
- L2 — **accordion**, not columns: 7 day sections, selected day expanded, others collapsed to one
  summary row (day, total, capacity bar). This is the focus+context degradation, and it is arguably
  _better_ than the desktop form for scanning a week.
- L3 — today's grid already has a separate mobile treatment; keep it.

The zoom control stays visible at all breakpoints; only what a level _renders_ changes.

## 8. State and URL model

Add two search params next to the existing `week`:

| Param  | Values                    | Notes                                           |
| ------ | ------------------------- | ----------------------------------------------- |
| `zoom` | `day` \| `week` \| `grid` | absent → the remembered preference, else `week` |
| `day`  | `YYYY-MM-DD`              | absent → today if in range, else week start     |

**Write them with `history.replaceState`, not `router.push`.** `app/time/page.tsx` is
`force-dynamic`; a `router.push` on every zoom or day change would re-issue the page's database
queries for data the client already holds. `src/lib/use-overlay-param.ts` already establishes this
pattern and documents the reasoning — extend it or add a sibling hook rather than inventing a third
approach. `replaceState` also keeps the browser Back button meaning "previous week", not "previous
zoom level", which is the right mapping.

**Remembered preference:** last used level in `localStorage`, applied only when `?zoom=` is absent.
Read it in an effect to avoid a hydration mismatch; with `initial={false}` the settle is invisible.
This alone removes half the perceived "constant clicking" — a member who lives in one level stops
re-choosing it on every visit.

**Default level:** `week` (L2) for a new member. It is the level that answers the most common question
and the one that has been missing. Open decision — see §14.

## 9. Architecture

The 95 KB single-file client is the main delivery risk. The new level does **not** go into it.

```
src/components/sheet/WeekAgenda/          ← new: the L2 level, presentational
  WeekAgenda.tsx
  WeekAgenda.types.ts
  WeekAgenda.variants.ts                  ← density / level-state variants (CVA)
  WeekAgenda.stories.tsx
  WeekAgenda.test.tsx
  index.ts
src/components/sheet/DayAgenda/           ← extracted from TimeGridClient's local DayView
app/time/
  TimeZoomShell.tsx                       ← new: owns zoom state, day strip, MotionConfig/LazyMotion
  motion-features.ts                      ← the domMax dynamic-import boundary
  motion.ts                               ← duration/easing constants mirroring the tokens
  TimeGridClient.tsx                      ← shrinks: keeps mutations, modals, quick actions
```

Per `src/components/README.md`: presentational components take data + callbacks; server mutations and
optimistic state stay at screen level. `WeekAgenda` therefore knows nothing about server actions — it
reports intent (`onSelectDay`, `onEditEntry`, `onAddEntry`, `onZoomToDay`).

**The orphaned library components.** `DayDetailPanel` and `WeeklyTimeGrid` are exported, stories'd,
visual-baselined — and unused by the real page. Building `WeekAgenda` in the library and _consuming
it_ moves in the right direction, but leaves `DayDetailPanel` as a near-duplicate of the extracted
`DayAgenda`. Recommendation: **retire `DayDetailPanel`** as part of this work (delete the folder, its
export, and `visual/…/day-detail-panel-dark-desktop-darwin.png`). It is dead code whose only cost
today is confusion. This deletes existing code, so it is an explicit decision — see §14.
`WeeklyTimeGrid` is a bigger reconciliation and stays out of scope.

## 10. i18n scope

New keys in **both** `messages/hu.json` and `messages/en.json` (a feature is not done until both are
complete):

- `TimeTracking.zoom.day` / `.week` / `.grid` — level labels (replacing `TimeTracking.view.*`)
- `TimeTracking.zoom.controlLabel` — the `SegmentedControl` accessible label
- `TimeTracking.zoom.announce` — the live-region string, e.g. `"Week view · {days} days · {total}"`
- `TimeTracking.zoom.zoomToDay` / `.zoomOut` — the direct-manipulation affordances
- `TimeTracking.zoom.keyboardHint` — discoverability for the shortcuts
- `TimeTracking.week.columnEmpty` — an empty day column
- `TimeTracking.week.capacity` — the capacity bar's accessible text

All numbers and dates format through `src/lib/formatting` so `Intl` stays the single authority.

## 11. Explicitly out of scope for v1

Each of these is a real idea; none is needed to make the axis work, and each would double the surface.

- **Rolling N-day range** instead of the ISO week. The browsing range and the _submission_ range are
  genuinely separable (timesheets are monthly, the approvable cap is weekly), but decoupling them
  touches `getMemberWeeklyTimeGrid` and every total on the page. Follow-up.
- **A month level (L4).** The axis is designed to accept one, but it needs data the page does not
  fetch. Follow-up, and the reason the level model is a list rather than a hardcoded triple.
- **Drag & drop entries between days.** The most attractive addition to L2, and the natural next step
  — but it needs move/copy semantics, locked-day rejection, and optimistic rollback. Separate work.
- **A clock-axis calendar** (hours on one axis, entries as positioned blocks). Entries here are
  duration-first: `startTime` / `endTime` are nullable on `TimeGridEntry` and the entry modal's
  duration mode writes neither, so a clock axis would leave most entries in an "all-day" tray with
  the axis as decoration. Only worth it if timed entries become the norm.
- **Command palette / natural-language quick add.** Strong idea, unrelated to the axis. `cmdk` is
  already a dependency, so it is cheap later.
- **Per-member target hours.** Verified against `prisma/*.prisma`: no target, budget, or expected-hours
  field exists anywhere in the schema. (`NotificationPreference.weeklyHoursReminder` is a boolean
  toggle with no threshold behind it, and no application code reads it.) v1's capacity bars therefore
  use the existing `DAILY_SOFT_WARNING_MINUTES` (8h) as the implicit daily target — no new domain
  state. Real per-member targets stay a schema decision.
- **Pinch / scroll zoom.** Rejected on merit, see §4.

## 12. Accessibility scope

- The level control is a real `SegmentedControl` with a translated `label`.
- A level change announces via `aria-live="polite"` — a sighted user sees the transition; a screen
  reader user must be told.
- L2 columns get real semantics: a heading per day and a list per column, not a grid of `div`s. L3
  today is a CSS grid of unlabelled `div`s and bare `<input>`s with no header association — a screen
  reader user gets almost no context per cell. Do not reproduce that in the new level.
- Focus is preserved across level changes (continuity contract #4).
- `MotionConfig reducedMotion="user"` (§6). Verify with the OS setting on, not just in DevTools.
- Keyboard shortcuts must not fire while a text input or textarea has focus.
- Focus treatment: the `:focus-visible` rule must stay in `@layer base` — new interactive surfaces
  inherit the app's two focus treatments rather than inventing a third.

## 13. Testing scope

| Gate            | What                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vitest**      | level ↔ URL sync; the continuity contract (selected day survives every transition, in both directions); capacity/total math; keyboard shortcuts ignored while typing |
| **Storybook**   | `WeekAgenda`: empty week, typical week, dense week (40+ entries), locked week, warning states, dark + light, mobile accordion                                        |
| **`play` test** | click a day header at L2 → lands on L1 with that day selected                                                                                                        |
| **Visual**      | new baselines per level × theme × viewport. Capture with reduced motion / animations disabled so a mid-transition frame can never land in a baseline                 |
| **e2e**         | `/time` has no spec today. A zoom-flow spec would be the first — worth adding, scoped as a stretch item, not a blocker                                               |
| **QA plan**     | append scenarios to `docs/manual-qa-test-plan.md`, committed separately as `docs(qa): …` per repo convention                                                         |

Note: `pnpm verify` currently stops early on a flaky Storybook test (`NotificationButton > Unread`),
which lands _before_ the visual and e2e steps. Expect to work around that when running the full chain.

## 14. Open decisions

Recommendations included; these are the calls worth making explicitly before implementation starts.

1. **Default level for a member with no stored preference.** _Recommend `week` (L2)_ — it is the level
   that has been missing and answers the most common question. Counter-argument: `grid` is the fastest
   for bulk entry, and existing members are used to it opening there.
2. **Retire `DayDetailPanel`?** _Recommend yes_ — it is unused, and `DayAgenda` replaces it. This
   deletes code and a visual baseline, so it should be a conscious call.
3. **Does L3 stay inline-editable at its zoom stop?** _Recommend yes_ — removing it would be a
   regression in bulk-entry speed. The alternative is L3 read-only with editing only at L2/L1, which
   is cleaner conceptually and worse in practice.
4. **Capacity bars in v1?** _Recommend yes, using the existing 8h soft-warning constant_ — they are
   what turns L2 from a list into an at-a-glance answer, and they need no schema change. The honest
   caveat is that 8h is an assumption, not a per-member target.
5. **Ship phases separately, or as one branch?** _Recommend separate_ — Phase 0 is valuable alone and
   reviewable in isolation.

## 15. Phasing

| Phase | Content                                                                                                                        | Ships value alone                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **0** | `zoom` + `day` search params, remembered preference, `SegmentedControl` swap, keyboard shortcuts. **No new level, no motion.** | Yes — the view survives a reload and is linkable |
| **1** | `WeekAgenda` (L2) + types/variants/stories/tests; extract `DayAgenda`; wire the middle stop. **Still no motion.**              | Yes — the itemized week, the actual ask          |
| **2** | `motion` dependency, motion tokens, layout transitions, the continuity contract, `MotionConfig reducedMotion`                  | Yes — the fluidity                               |
| **3** | Capacity bars, live-region announcements, a11y semantics, mobile accordion polish                                              | Yes                                              |
| **4** | Visual baselines, i18n completeness sweep, QA plan scenarios, optional e2e                                                     | Closes the feature                               |

Phase 1 is the feature. Phase 2 is what makes it feel like the product you described. Phases 0 and 3
are the parts that are easy to skip and expensive to retrofit.

## 16. Housekeeping

This work needs its own branch off `develop` — the current working tree is on
`feature/multi-select-filters` with unrelated uncommitted changes (StatusPill, admin filters). Do not
mix them. Adding `motion` is a new runtime dependency, which `CLAUDE.md` requires asking about first;
it was proposed and accepted in the discussion that produced this document.
