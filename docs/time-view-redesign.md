# Time View Redesign — Scope, Lens and Motion

**Status:** implemented (R0–R4) on the `/time` route · this document is the design record; §15 lists the decisions as taken
**Surface:** `/time` (`app/time/TimeZoomShell.tsx`, `app/time/TimeGridClient.tsx`, `WeekAgenda`,
`DayAgenda`, `MonthOverview`, `SegmentedControl`)
**Relationship to other docs:** this revises the _presentation_ half of `docs/time-view-zoom-axis.md`
(§5–§7, §9–§10) and keeps its data model, tracking modes, locking and financial-chain decisions
untouched. It absorbs the surface-level items of `docs/time-tracking-ux-upgrades.md` (A2, A3, A7,
B3, B4, C2). Settled decisions in `docs/time-view-zoom-axis-implementation.md` stay settled except
where §15 below explicitly re-opens one and says why.

---

## 0. In one paragraph

The zoom axis shipped the right _model_ (one week of data, four resolutions, one selected day that
survives every change) wrapped in the wrong _chrome_. Four coequal pills, a keyboard legend, arrows
whose unit changes silently, and a day strip that duplicates the seven column headers right below it
make the page explain itself in words instead of in shape. This proposal keeps the axis and the
continuity contract, but re-cuts the surface into three **scopes** (Day · Week · Month) that form a
real time hierarchy plus one **lens** switch on the week (Agenda ⇄ Grid), removes every redundant
row, moves the keyboard hints onto the controls and behind `?`, binds the arrows to the unit the
header already shows, and spends the motion budget on _spatial_ transitions: a day column visibly
becomes the Day page, a month cell visibly becomes the day it names. Five rows of chrome become
two.

---

## 1. What is wrong today, precisely

Grounded in the two screenshots and the current code (`TimeZoomShell.tsx`, `zoom.ts`,
`TimeGridClient.tsx`).

| #   | Symptom                                                                                                                                                                                  | Root cause                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "I can only switch modes by clicking the pills; the arrows don't do it." The arrows sit directly under the pills and look like they belong to them.                                      | Two unrelated axes (resolution and time) share one visual cluster with no glyph vocabulary separating them. `−`/`+` exist only as invisible keystrokes.                                  |
| 2   | `1-4 level · − + step · [ ] week · t today` is unreadable. "level" appears nowhere else on screen, "step" is ambiguous, `[ ]` looks like a checkbox.                                     | A legend in the chrome is the wrong home for shortcuts. Every fast calendar (Notion Calendar, Fantastical, Google Calendar, Vimcal) puts them in tooltips and a `?` sheet, never inline. |
| 3   | The Week view says "Monday" three times before any entry is visible: in the range label, in the day strip chip, in the column header. The daily total appears twice (chip bar + header). | The strip is "persistent chrome that never unmounts" (§7 of the axis doc). Architecturally clean, perceptually redundant whenever all seven columns are already on screen.               |
| 4   | `DAY TOTAL 8.5 h` sits at the right of the strip while seven columns each show their own total. It is orange, which reads as emphasis, not as "over 8 h".                                | A day-scoped figure rendered in a week-scoped view. Colour carries a status alone, which the token rules forbid.                                                                         |
| 5   | The quick-action row mixes six things of equal weight: two copy actions, three static "Assigned" chips, two clickable "Recent" chips. The same two projects appear in both groups.       | Actions that belong to a _moment_ (an empty day, an empty week, the moment of adding an entry) were promoted to permanent toolbar.                                                       |
| 6   | Grid is presented as a zoom level between Week and Month, but it covers the same seven days as Week. Users read it as "another way to see the week", not "further out".                  | The axis invariant (coverage grows, detail shrinks) holds for detail only. Grid is a lens on the week, not a stop on the axis.                                                           |
| 7   | Clicking the already-selected day chip zooms out. Nothing on screen suggests it.                                                                                                         | A hidden gesture with no affordance.                                                                                                                                                     |
| 8   | At Day level the arrows still move a whole week.                                                                                                                                         | The arrow unit is bound to the data payload (a week) rather than to what the header shows.                                                                                               |
| 9   | Edit/delete icons are always visible on every card; the project name is an uppercase caption above the description. Cards are heavy and every one shouts.                                | No hover/focus reveal, no hierarchy between the thing (description) and its context (project, time).                                                                                     |
| 10  | `[`/`]` need AltGr on a Hungarian QWERTZ layout, and `suppressesZoomShortcut` bails when Alt is held. Half the target audience may be unable to type the period shortcut at all.         | Shortcut keys chosen for a US layout.                                                                                                                                                    |

---

## 2. Principles

1. **One spine, one direction.** The date is the spine. Above the content the page answers exactly
   two questions, in this order: _when_ (the period header) and _how close_ (the scope control).
   Arrows only ever move _when_. The scope control only ever moves _how close_. They never share a
   glyph: arrows are `‹ ›`, zoom is `⊖ ⊕` (the vocabulary of every map and design tool).
2. **The header is the unit.** "Week 36 · Aug 31 – Sep 6" with arrows beside it can only mean
   "move a week". "Monday, Aug 31" beside arrows can only mean "move a day". No legend needed.
3. **Zoom is spatial.** Month contains weeks, Week contains days, Day contains entries. You zoom in
   by clicking the thing you want to see closer, and it grows into the page. You zoom out with `⊖`,
   the scope control, or `Esc`, and the page shrinks back into its slot. Motion exists to show
   _where things went_, not to decorate.
4. **Nothing is said twice.** Every day label, every total, every project name appears once per
   view. If two elements would show the same fact, one of them becomes the other through a shared
   `layoutId` instead of coexisting.
5. **Actions live where they are needed.** "Copy yesterday" belongs to an empty day. "Duplicate last
   week" belongs to an empty week. Recent projects belong to the moment you add an entry. The
   permanent toolbar holds only the two things you might do at any time: start a timer, add an
   entry.
6. **Fast, quiet, honest motion.** Under 300 ms, ease-out, transform and opacity only, `initial`
   off on first paint, reduced-motion respected. Financial figures never roll.

---

## 3. The model: scope × lens

Today: four coequal levels, `zoomLevels = ["day", "week", "grid", "month"]`.

Proposed: three **scopes** on a true time hierarchy, and one **lens** that applies to the week.

|                | Day                        | Week                                                  | Month                                               |
| -------------- | -------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Coverage       | 1 day                      | 7 days                                                | 1 month                                             |
| Lenses         | Agenda                     | **Agenda** (cards per day) · **Grid** (project × day) | Overview (heat navigator + project bands)           |
| Arrows step by | 1 day                      | 1 week                                                | 1 month                                             |
| Header reads   | `Monday, Aug 31, 2026`     | `Week 36 · Aug 31 – Sep 6, 2026`                      | `September 2026`                                    |
| Primary job    | read the day, fix an entry | Agenda: what did I do · Grid: fill the week fast      | close the month, declare hours, spot forgotten days |
| Zoom in by     | —                          | click a day header → Day                              | click a heat cell → Day · click a week row → Week   |

Mapping from today, so nothing is lost:

| Today `?zoom=` | Proposed                 |
| -------------- | ------------------------ |
| `day`          | `scope=day`              |
| `week`         | `scope=week&lens=agenda` |
| `grid`         | `scope=week&lens=grid`   |
| `month`        | `scope=month`            |

`?day=` stays the single anchor; week and month are derived from it exactly as today
(`resolveSelectedMonthStartIso`). Legacy `?zoom=` links keep working through a one-line mapping.

**Which stops a member gets** is unchanged in substance: a declared-only member gets Month alone and
no scope control (§5 of the axis doc). A tracked or hybrid member gets all three scopes and both
lenses. The lens is remembered per member (`localStorage`, same mechanism as the remembered level
today); the default lens is Agenda, and the default scope stays Week on desktop. On a phone the
default scope is Day (§9).

Why this is not a regression of the axis idea: the invariant "zoom out = more coverage, less detail"
now holds _exactly_, at every step, because the one stop that broke it (Grid, same coverage as Week)
is no longer a stop. `−`/`+` still walk Day ⇄ Week ⇄ Month monotonically.

---

## 4. Anatomy of the page

Everything above the content is two rows. Row 1 is _how close_ and the two global actions. Row 2 is
_when_ and the total of the thing you are looking at.

```
Row 1  ⊖ ┃ Day ¹ │ Week ² │ Month ³ ┃ ⊕    ┆  ☰ Agenda ▦ Grid          ▷ Start timer   + New entry
Row 2  ‹  Week 36 · Aug 31 – Sep 6, 2026  ›   Today                                    36 h  this week
```

- The scope control has `⊖`/`⊕` end caps: visible, clickable, and the answer to "why can't I use
  arrows to change the mode". They _are_ the zoom arrows, in zoom glyphs, on the zoom control.
- Each segment carries its shortcut as a small `kbd` chip (`¹ ² ³`), muted until the control is
  hovered or focused, then full contrast. Linear, Vimcal and Notion Calendar all do this instead of
  a legend.
- The lens toggle appears to the right of the scope control **only in Week scope**, fading in with
  a 6 px slide (`AnimatePresence`). Two icon segments with labels, `☰ Agenda` and `▦ Grid`, its own
  `radiogroup`.
- `Today` is a real button, `aria-disabled` and dimmed while today is in view. A small mint dot on
  the button's left says "you are here" when it is disabled, which is how Google Calendar's Today
  button reads.
- The period total on the right is one figure with one unit label: `36 h this week`, `8.5 h
today`, `112 h this month`. Nothing day-scoped is shown at Week scope.

### 4.1 Week scope · Agenda lens (the hub)

```
⊖ ┃ Day ¹ │ ●Week ² │ Month ³ ┃ ⊕    ┆  ●☰ Agenda  ▦ Grid                 ▷ Start timer   + New entry
‹  Week 36 · Aug 31 – Sep 6, 2026  ›   ● Today                                        36 h  this week

┌ MON 31 ·· 8.5 h ›┐┌ TUE 1 ··· 6.5 h ›┐┌ WED 2 ···· 8 h ›┐┌ THU 3 ···· 8 h ›┐┌ FRI 4 ···· 5 h ›┐┌ SAT 5 ›┐┌ SUN 6 ›┐
│ ████████████ over │ ████████░░░░      │ ████████████     │ ████████████     │ ███████░░░░░     │        │        │
│▌Internal dashb…   │▌Code review       │▌Dev tooling imp… │▌API endpoint imp…│▌alma             │ Nothing│ Nothing│
│ Internal Ops      │ Atlas Platform    │ Internal Ops     │ Atlas Platform   │ Atlas Platform   │ logged │ logged │
│            4.25 h │             5 h   │           2.5 h  │          1.75 h  │            4 h   │        │        │
│▌Code review       │▌Dev tooling imp…  │▌Code review      │▌Dev tooling imp… │▌eewes            │        │        │
│ Atlas Platform    │ Internal Ops      │ Atlas Platform   │ Internal Ops     │ Atlas Platform   │        │        │
│            4.25 h │           1.5 h   │           5.5 h  │          6.25 h  │            1 h   │        │        │
│ ┄┄┄┄┄ + ┄┄┄┄┄     │ ┄┄┄┄┄ + ┄┄┄┄┄     │ ┄┄┄┄┄ + ┄┄┄┄┄    │ ┄┄┄┄┄ + ┄┄┄┄┄    │ ┄┄┄┄┄ + ┄┄┄┄┄    │ ┄ + ┄  │ ┄ + ┄  │
└───────────────────┘└───────────────────┘└──────────────────┘└──────────────────┘└──────────────────┘└────────┘└────────┘
  Atlas Platform is declared monthly · see Month →
```

- **The day strip is gone at this scope.** The seven column headers _are_ the day chips: weekday,
  day number, total, capacity bar. Each header is a button (`Open Monday, Aug 31`), with a `›`
  that appears on hover and a lift of 1 px. This replaces the hidden "click the chip again" gesture
  with an affordance you can see.
- Today's column gets a 2 px mint top rule and a slightly lighter header, nothing else. Weekend
  columns are narrower when empty (`minmax(7rem, 0.6fr)` vs `1fr`) so the working week gets the
  room.
- Cards: 3 px project-colour rail on the left, description as the primary line, project name and
  optional `09:00 – 13:15` as the muted meta line, duration right-aligned in tabular numerals.
  Edit / Delete / **Continue** (start a timer with this project and description, `A3`/`C2` of the
  upgrades doc) reveal on hover and on `:focus-within`; on touch a `⋯` menu is always present.
  Locked entries show a lock glyph in the meta line and a muted rail.
- The `+` at the foot of each column opens the **quick composer** (§5.6) anchored to that column,
  not the full modal.
- The hybrid handoff line stays, restyled as a quiet footnote under the columns with a link into
  Month. It no longer sits between the controls and the content.

### 4.2 Week scope · Grid lens

```
⊖ ┃ Day ¹ │ ●Week ² │ Month ³ ┃ ⊕    ┆  ☰ Agenda  ●▦ Grid                 ▷ Start timer   + New entry
‹  Week 36 · Aug 31 – Sep 6, 2026  ›   ● Today                                        36 h  this week

 Project                    MON 31 ›  TUE 1 ›  WED 2 ›  THU 3 ›  FRI 4 ›  SAT 5 ›  SUN 6 ›   Week
 ● Atlas Platform             4.25     5        5.5      1.75     5        ·        ·        21.5
 ● Internal Ops & Tooling     4.25     1.5      2.5      6.25     ·        ·        ·        14.5
 ● one time test           declared monthly · see Month →                                    —
                              8.5      6.5      8        8        5        0        0        36
```

- Substance unchanged (inline editing, `Enter` commits, arrow keys reserved for cells). The seven
  column headers are the **same components** as the Agenda headers and share `layoutId`, so the
  lens switch crossfades the bodies while the headers do not move at all: the week "re-sorts" under
  fixed headers.
- Hover crosshair: the hovered cell's row and column tint by one surface step (`--secondary`),
  140 ms. Today's column keeps its mint rule.
- A declared project shows as a **ghost row** where it would otherwise be missing, non-editable,
  with the handoff link. The absence is explained where it is felt.

### 4.3 Day scope

```
⊖ ┃ ●Day ¹ │ Week ² │ Month ³ ┃ ⊕                                          ▷ Start timer   + New entry
‹  Monday, Aug 31, 2026  ›   Today                                    8.5 h  today · ⚠ over 8 h

 ┃MON 31┃ TUE 1   WED 2   THU 3   FRI 4   SAT 5   SUN 6        ← week ribbon, chips with capacity bars
 ┃█████ ┃ ████    █████   █████   ███     ·       ·

┌──────────────────────────────────────────────────────┐  ┌ Monday ────────────────────────┐
│▌Internal dashboard updates                   4.25 h  │  │      ◔ 8.5 h                   │
│ Internal Ops & Tooling · 09:00 – 13:15    ✎  ▷  🗑    │  │      of 8 h target             │
│                                                      │  │ ● Atlas Platform      4.25 h   │
│▌Code review                                  4.25 h  │  │ ● Internal Ops        4.25 h   │
│ Atlas Platform · 13:45 – 18:00             ✎  ▷  🗑   │  │                                │
│                                                      │  │ Quick add                      │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ + Add entry ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │  │ [Atlas] [Internal Ops]         │
└──────────────────────────────────────────────────────┘  │ [ 2h30 ] [ what did you do… ] ↵ │
                                                          └────────────────────────────────┘
```

- **The week ribbon lives here**, and only here on desktop. It is the week context for a single
  day and the navigator between days. It is the same seven elements as the Week headers, carrying
  the same `day-<iso>` `layoutId`, so zooming Week → Day shrinks the headers into the ribbon and
  zooming out grows them back (§7.2).
- Arrows and `J`/`K` move **one day**. Crossing a week boundary slides the whole ribbon sideways
  (direction-aware) and fetches the next week as today's `?week=` change does.
- The right rail is what makes Day a real zoom-in rather than a narrow Week: a **target ring**
  (8 h soft-warning constant, settled decision 4), the day's per-project split, and the quick
  composer already open, so the most common Day task (add what I just did) is one field away.
  The ring is amber only together with the `⚠ over 8 h` label; colour never speaks alone.
- Below `lg` the rail stacks under the list; the composer becomes the bottom-sheet in §9.

### 4.4 Month scope

```
⊖ ┃ Day ¹ │ Week ² │ ●Month ³ ┃ ⊕                                          ▷ Start timer   + New entry
‹  September 2026  ›   Today                                112 h  this month · 14 of 22 workdays

        MON  TUE  WED  THU  FRI  SAT  SUN
 W36 ›   ▣    ▣    ▣    ▣    ▣    ·    ·      36 h      ← the week you return to (highlighted row)
 W37 ›   ▣    ▣    ◻    ◻    ◻    ·    ·      14 h      ◻ = past workday, nothing logged
 W38 ›   ◻    ◻    ◻    ◻    ◻    ·    ·      —
 W39 ›   ○    ○    ○    ○    ○    ·    ·      —         ○ = future
 W40 ›   ○    ○    ○    ○                     —

 Tracked this month
 ● Atlas Platform ································ 64 h  ›
 ● Internal Ops & Tooling ························ 48 h  ›

 Declared monthly
 ● one time test        [ 52 ] h   [ what the hours cover… ]   [ proof.pdf ✓ ]   Declared
```

- The **heat navigator** replaces the de-emphasised day strip as "the week you will return to". It
  is a month of days, intensity by hours logged (four steps of `--primary-soft` → `--primary`),
  hollow for a past workday with nothing logged, dotted for future, a ring for today, a lock glyph
  when the month is submitted. Hover: `Tue 1 · 6.5 h · 2 entries`. Click a cell → Day; click a
  week number → Week (Agenda). The selected week's row is tinted one surface step.
- This is the one screen where "which days did I forget before I submit?" is answered at a glance,
  which today needs a week-by-week scroll. It is also the natural home for B3 (a target bar) at the
  month grain: `14 of 22 workdays`.
- The bands below are `MonthOverview` unchanged. Tracked rows are still the click-through to the
  Grid lens of the anchored week (`›`).

---

## 5. Controls, one by one

### 5.1 Scope control

`SegmentedControl` gains three things and loses nothing:

- **Sliding thumb.** The selected background becomes one `m.span layoutId="scope-thumb"` behind
  the radios instead of a `bg-primary` class on the selected button. It travels with a spring
  (§7.5). This is the difference between "a different pill lit up" and "the selection moved".
- **`shortcut` per item**, rendered as a `kbd` chip after the label. Muted (`--text-subtle`) at
  rest, `--muted-foreground` when the group is hovered or contains focus. Hidden below `lg`.
- **End caps `⊖` / `⊕`** rendered by the composing `TimeScopeBar`, not by `SegmentedControl`
  itself: two icon buttons flush to the track, `aria-label="Zoom out to Week"` / `"Zoom in to
Day"` recomputed per state, disabled at the ends. Tooltip: `Zoom out · −`.

The `radiogroup` label changes from `Detail level` to `View` (`Nézet`). Radios stay `Day` / `Week`
/ `Month`.

### 5.2 Lens toggle

A second `SegmentedControl`, `size="sm"`, icon + label, `aria-label="Week layout"`, items `Agenda`
and `Grid`, shortcut `G`. Mounted only in Week scope. Entering: opacity 0 → 1 and `x: -6 → 0`,
140 ms. Leaving: opacity only. The thumb inside it has its own `layoutId="lens-thumb"`.

Pressing `G` from Day or Month goes to Week + Grid in one move; pressing it in Week toggles the
lens. The remembered lens is what Week opens in next time.

### 5.3 Period navigator

`‹  <label>  ›  Today`. The label is a button too: it opens a `MonthPicker` (exists in `ui`) to jump
anywhere without leaving the scope, the Notion Calendar rule that a date picker changes the date,
never the view. Label formats:

| Scope | EN                               | HU                                     |
| ----- | -------------------------------- | -------------------------------------- |
| Day   | `Monday, Aug 31, 2026`           | `2026. aug. 31., hétfő`                |
| Week  | `Week 36 · Aug 31 – Sep 6, 2026` | `36. hét · 2026. aug. 31. – szept. 6.` |
| Month | `September 2026`                 | `2026. szeptember`                     |

Week numbers are ISO and formatted through `src/lib/formatting`; Hungarian working culture uses
them constantly, English readers get the range as well. Arrows carry tooltips with their unit and
key: `Previous week · K`. The label slides 8 px in the direction of travel on every step (§7.3).

### 5.4 Week ribbon (Day scope, and every scope on mobile)

The existing strip from `TimeZoomShell.tsx`, extracted to `sheet/DayRibbon`, and **no longer
persistent chrome** on desktop. It is rendered in Day scope, and on mobile in Week scope as the
accordion's collapsed rows. Each chip keeps its capacity bar, `aria-pressed`, and the
`Select Monday` name. The double-click-to-zoom-out gesture is removed; zooming out is `⊖`, `−`,
`Esc` or the scope control.

Because the ribbon and the Week headers are never mounted at the same time, the chips **can** now
carry `day-<iso>`, which the current code forbids for the strip. That single change is what makes
the Week ⇄ Day container transform possible (§7.2).

### 5.5 Period total

One number, one unit label, right-aligned in row 2. `36 h this week` · `8.5 h today` · `112 h this
month`. Poppins, tabular numerals, the `h` in `--muted-foreground`. Status is icon + words, and only
then colour: `⚠ over 8 h` in amber, `✓ on target` in success. Never a bare orange number. The
figure **settles**, it does not roll (§7.6).

### 5.6 Quick composer

The `+` in a column, the `Quick add` block in the Day rail, and `N` all open the same compact
composer: a `Popover` anchored to the trigger (or the bottom sheet on mobile) with

```
 Mon, Aug 31
 [● Atlas]  [● Internal Ops]  [● one time test]        ← recent first, then the rest of assigned
 [ 2h30            ]  [ What did you do?                        ]
 ⌥ Interval instead   ·   More options →                                    [ Add ]  ↵
```

Duration accepts what the grid already parses (`3.5`, `3:30`, `3h 20m`, `200m`). `More options`
expands into today's full entry dialog with the fields carried over. This is Toggl's favourites bar
and Linear's quick-create in one: two clicks from "I need to log this" to "logged", without leaving
the week. The "Recent" chip row from the toolbar moves here, which is where it was always needed.

On save, the popover closes, the new card enters in place with the stagger, and its rail pulses
once with `--elevation-glow` (§7.7).

### 5.7 Quick actions become contextual

- **Empty day column**: under `Nothing logged`, a ghost link `Copy yesterday` when yesterday has
  entries. Same confirm dialog as today.
- **Empty week**: a centred empty state with two buttons, `Add entry` and `Duplicate last week`.
- **Non-empty week**: `Duplicate last week` and `Copy yesterday into <day>` live in a `⋯` menu at
  the far right of row 2, next to the total. Present, findable, not shouting.
- **Assigned chips** are removed. Assigned projects are the rows of the Grid lens and the chips of
  the composer; a third static listing adds nothing.

### 5.8 Entry card

```
▌ Internal dashboard updates                              4.25 h
▌ Internal Ops & Tooling · 09:00 – 13:15                ✎  ▷  🗑
```

- Rail: 3 px, project colour (`ProjectColorSwatch` token), replaces the dot + uppercase caption.
- Line 1: description, `--foreground`, one line with ellipsis in Week, wraps in Day.
- Line 2: project · interval (if `startTime`), `--muted-foreground`, `text-xs`.
- Actions: `✎ Edit`, `▷ Continue` (starts a timer with this project and description, `C2`),
  `🗑 Delete`, revealed on hover and `:focus-within`, 140 ms opacity. Touch: a `⋯` menu, always
  visible.
- Delete is **undoable** for 6 s through a toast (`A2`); the card leaves with the exit transition and
  returns with the enter transition if undone.
- Timer-sourced entries carry a small `▷` glyph before the duration (`B4`). Admin-modified entries
  keep the `ShieldCheck` notice.

### 5.9 Timer

`▷ Start timer` is a ghost button in row 1. When a timer runs it **morphs** (`layoutId="timer"`)
into a live pill in the same slot: `● 00:42:13 · Atlas Platform  ■`, the dot pulsing at 1.6 s
(hidden under reduced motion, like the existing `auth-gyro-pulse`). In Day scope for today, and in
today's column in Week scope, the running timer also appears as a **live card** at the top of the
list with a mint rail and the ticking duration, the Toggl convention that the timer is the first row
of today. Stopping it converts the live card into a normal card in place. `S` starts or stops
(`A7`).

The full-size `RunningTimerCard` is retired in favour of the pill plus the live card.

### 5.10 Empty and edge states

| State                     | Treatment                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Empty day column          | `Nothing logged` + ghost `Copy yesterday` when applicable + the `+`                          |
| Empty week                | Centred: `Nothing logged this week` · `Add entry` · `Duplicate last week`                    |
| Future day                | Header and cards at 70 % opacity, `+` still enabled (future dates save with a warning today) |
| Locked day / week / month | Lock glyph in the header, cards non-interactive, existing banner text, `+` hidden            |
| Over 8 h                  | Capacity bar amber, header total `⚠ 8.5 h`, tooltip with the existing warning copy           |
| Hybrid handoff            | Footnote under Week content; ghost row in Grid; `Month` segment gets a 4 px dot badge        |
| No assignments at all     | Existing page-level empty state, scope control hidden                                        |
| Declared-only member      | Month only, no scope control, no ribbon, heat navigator hidden (there are no days to show)   |

---

## 6. Navigation flows

Every move is one of four kinds. Each has one gesture family, one keyboard family, one motion.

| Move         | Pointer                                                                                                   | Keyboard                    | Motion (§7)                               |
| ------------ | --------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------- |
| **Zoom in**  | click a day header (Week → Day) · click a heat cell (Month → Day) · click a week row (Month → Week) · `⊕` | `+` · `1`/`2`               | container transform, scale 0.96 → 1 in    |
| **Zoom out** | `⊖` · scope control                                                                                       | `−` · `Esc` · `2`/`3`       | container transform, scale 1.04 → 1 in    |
| **Step**     | `‹` `›`                                                                                                   | `K` / `J` (aliases `[` `]`) | shared-axis slide, 24 px, direction-aware |
| **Jump**     | `Today` · label → `MonthPicker`                                                                           | `T`                         | slide in the direction of the jump        |
| **Re-lens**  | Agenda ⇄ Grid                                                                                             | `G`                         | headers hold, bodies crossfade            |

The selected day survives every one of these, as today. Focus survives: the element that had focus
keeps it if it still exists, otherwise focus moves to the new view's period label, never to `body`.

---

## 7. Motion choreography

The library, the `LazyMotion` + `domMax` boundary, `MotionConfig reducedMotion="user"`, the
`initial={false}`-after-first-paint rule and the ≤ 30 layout participants budget are all kept from
§9 of the axis doc. What changes is _what_ animates and _why_.

### 7.1 Tokens

Existing: `--ease-standard` `cubic-bezier(0.2, 0.7, 0.2, 1)`, `--ease-exit`
`cubic-bezier(0.4, 0, 1, 1)`, `--duration-level` 260 ms, `--duration-micro` 140 ms,
`--duration-bar` 300 ms, `--stagger-entry` 18 ms. Proposed additions to `app/globals.css`,
`docs/tokens.md` and the mirror in `src/lib/motion.ts`:

| Token               | Value                                   | Used for                                                    |
| ------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `--duration-step`   | `200ms`                                 | a date step (shared-axis slide)                             |
| `--duration-settle` | `180ms`                                 | a figure changing (one-step settle, §7.6)                   |
| `--distance-step`   | `24px`                                  | slide distance of a date step                               |
| `--scale-zoom`      | `0.96` / `1.04`                         | the incoming view when zooming in / out                     |
| `--spring-thumb`    | `stiffness 520 · damping 42 · mass 0.8` | scope and lens thumbs (settles ≈ 220 ms, no visible bounce) |
| `--spring-ring`     | `stiffness 180 · damping 26`            | target ring and capacity bars                               |
| `--stagger-entry`   | **`24ms`** (was 18)                     | cards arriving, cap stays 8 → ≤ 168 ms                      |

Everything stays under 300 ms and ease-out. Nothing eases in.

### 7.2 Zoom: the container transform

The headline. Week → Day, clicking `WED 2 ›`:

1. All seven headers carry `layoutId={dayLayoutId(iso)}`. The Day ribbon's seven chips carry the
   same ids. Because the ribbon mounts as the headers unmount, Motion projects each header into its
   chip: seven small FLIP moves, the selected one landing on the filled chip.
2. The selected day's cards carry `entryLayoutId(id)` in both views (already the rule). They grow
   from a 7-column card into a full-width row with `layout="position"` so text does not stretch.
3. The other six columns' cards exit opacity-only, `--ease-exit`, 140 ms. No movement: they are
   leaving, not going somewhere.
4. The Day rail enters last: opacity 0 → 1, `y: 8 → 0`, 200 ms, delayed 80 ms so the transform
   reads before the new information arrives.
5. The content container itself runs `scale: 0.96 → 1`, `opacity 0 → 1` under the layout moves.
   Zooming out inverts it (`1.04 → 1`). Scale direction is what tells the eye "closer" vs
   "farther"; the shared elements tell it "the same thing".

Month → Day, clicking a heat cell: the cell carries `dayLayoutId(iso)` too (the heat navigator and
the ribbon are never mounted together), so the 14 px cell grows into the selected chip while the
page scales in. Month → Week, clicking a week row: the row's seven cells become the seven headers.

Layout participants per transition: 7 headers/chips + ≤ 8 staggered cards + 1 container ≤ 16.
Cards past the eighth appear immediately.

### 7.3 Step: the shared-axis slide

`AnimatePresence mode="popLayout" custom={direction} initial={false}` around the content, keyed by
the period start ISO. Variants:

```ts
const stepVariants = {
  enter: (dir: 1 | -1) => ({ x: dir * 24, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.2, ease: EASE_STANDARD } },
  exit: (dir: 1 | -1) => ({
    x: dir * -24,
    opacity: 0,
    transition: { duration: 0.14, ease: EASE_EXIT },
  }),
};
```

Next slides in from the right, previous from the left. The period label runs the same variants at
8 px. `popLayout` takes the leaving view out of flow so the incoming one never waits. `Today` and the
month picker compute `direction` from the sign of the date difference so a jump backwards slides
backwards.

Within Day scope, crossing a week boundary also slides the ribbon as one block; inside the week only
the selected chip's thumb moves (`layoutId="ribbon-thumb"`, `--spring-thumb`).

### 7.4 Re-lens: fixed headers, swapped bodies

The seven headers share ids across lenses and therefore do not move. The Agenda bodies exit
opacity-only; the Grid table enters opacity 0 → 1 with `y: 4 → 0`, 200 ms, rows staggered at 12 ms
capped at 8. Reverse for Grid → Agenda, with the usual card stagger. The lens thumb moves on
`--spring-thumb`.

### 7.5 Thumbs

`scope-thumb`, `lens-thumb` and `ribbon-thumb` are each one `m.span` with a `layoutId`, absolutely
positioned behind the radios, `--spring-thumb`. `LayoutGroup id="time"` namespaces the ids so a
second segmented control elsewhere on the page cannot collide. Keyboard arrows inside the group move
the thumb the same way a click does.

### 7.6 Figures settle, they do not roll

The axis doc's restraint stands: a figure that feeds a timesheet revision never counts up. But a
figure that changes with no motion at all reads as a glitch, so it **settles**: the old value exits
`y: -6, opacity 0`, the new value enters from `y: 6` if it went up and from `y: -6` if it went down,
180 ms, `AnimatePresence mode="popLayout"` keyed by the formatted string. One step, in the direction
of change, digits always exact. The same treatment applies to per-day header totals and the month
band totals. Grid cell values still swap instantly while you type.

### 7.7 Feedback

- **Saved**: the new or edited card's rail and border run `box-shadow: none → --elevation-glow →
none` over 600 ms, `--ease-standard`. One pulse, no repeat.
- **Deleted**: exit transition, siblings close the gap through `layout` on the list, an undo toast
  for 6 s. Undo re-enters with the enter transition.
- **Over target**: when a save pushes a day past 8 h, its capacity bar fills on `--spring-ring` and
  the `⚠` label enters with the settle transition.
- **Timer start**: the button → pill morph (`layoutId="timer"`, `--duration-level`), then the live
  card enters at the top of today's list with the card enter transition.

### 7.8 Reduced motion

`MotionConfig reducedMotion="user"` already strips transforms and layout animation while keeping
opacity, which turns every transition above into a crossfade. Two explicit additions: the timer
pulse is not rendered, and the heat navigator's cell stagger (§7.9) is skipped. Nothing loses its
state change.

### 7.9 First paint and the heat navigator

Nothing animates on first paint (`useAfterFirstPaint`). The one exception granted to the Month
scope on a _level change_ into it: heat cells fade in row by row, 12 ms per row, so the month
"draws" in under 100 ms. It is the only decorative stagger on the surface and it earns its place by
showing the reading order of the grid.

### 7.10 Motion API map

| Need                                      | API                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Shared elements across views              | `m.div layoutId=…` inside `LayoutGroup id="time"`, `domMax` features                        |
| Cards that resize without stretching text | `layout="position"`                                                                         |
| Direction-aware step                      | `AnimatePresence mode="popLayout" custom={direction}` + function variants                   |
| Springs                                   | `transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.8 }}`                   |
| Stagger                                   | `entryEnterTransition(index)` as today, with `STAGGER_ENTRY = 0.024`                        |
| Press feedback on chips                   | `whileTap={{ scale: 0.97 }}`, 100 ms                                                        |
| Reduced motion                            | `MotionConfig reducedMotion="user"` (existing) + `useReducedMotion()` for the pulse/stagger |

`AnimatePresence` needs a stable `key` on the direct child; the period start ISO for steps, the
formatted string for figures, `entry.id` for cards.

---

## 8. Keyboard and discoverability

The legend goes. Its three replacements:

1. **On the controls.** `kbd` chips in the scope and lens segments; tooltips on `⊖ ⊕ ‹ › Today` and
   on the two toolbar buttons, each ending with the key.
2. **A shortcut sheet** on `?` (and from the `⋯` menu and the command palette): a `Dialog` listing
   every shortcut in two columns, grouped as View · Move · Add · Timer.
3. **The command palette** (`⌘K`, exists in `layout/CommandPalette`) gains the time commands so
   every action is searchable by name in both locales: Go to today, View: Day / Week / Month, Week
   layout: Agenda / Grid, New entry, Start timer, Stop timer, Duplicate last week, Copy yesterday,
   Keyboard shortcuts.

The map:

| Key         | Action                                                    | Note                                     |
| ----------- | --------------------------------------------------------- | ---------------------------------------- |
| `1` `2` `3` | Day · Week · Month                                        | as today, one fewer                      |
| `−` `+`     | zoom out · zoom in                                        | as today; now also visible as `⊖ ⊕`      |
| `G`         | Grid lens (toggle in Week; jump to Week + Grid elsewhere) | replaces `4`                             |
| `K` `J`     | previous · next period in the current scope's unit        | **new primary**; `[` `]` stay as aliases |
| `T`         | today                                                     | as today                                 |
| `N`         | new entry on the selected day (quick composer)            | new                                      |
| `S`         | start / stop timer                                        | new (`A7`)                               |
| `Esc`       | zoom out one step when no overlay is open                 | new, optional (§15.5)                    |
| `?`         | shortcut sheet                                            | new                                      |
| `⌘K`        | command palette                                           | exists                                   |
| `↑ ↓ ← →`   | still unclaimed, reserved for grid cells                  | as today                                 |

Why `J`/`K` and not the brackets: on the Hungarian QWERTZ layout `[` and `]` are `AltGr+F` and
`AltGr+G`, and `suppressesZoomShortcut` ignores any keystroke with Alt held, so the current period
shortcut is unusable for a large share of the users this app is built for. `J`/`K` are unmodified on
every layout and are the Google Calendar, Notion Calendar and Vimcal convention. `−` and `+` should
be verified on the HU layout in the same pass. The suppression rules (inputs, dialogs, modifiers)
stay as they are.

A one-time, dismissible hint on the first visit after the change: `New here: press ? for shortcuts,
or click a day to open it.` Toast, not a tour.

---

## 9. Mobile (`< lg`)

The ribbon is justified exactly where seven columns cannot be shown, which is why it moves to the
phone and leaves the desktop week.

- **Default scope is Day.** Ribbon under the period header, horizontally scrollable if the chips
  do not fit, the selected chip snapping to centre. Single list, the rail stacked below it as a
  collapsible `Today at a glance` card. `+` is a fixed bottom-right FAB (peach, `--elevation-glow-warm`)
  that opens the composer as a bottom sheet (`Drawer`).
- **Week · Agenda** stays the accordion. Its collapsed rows _are_ the ribbon chips laid vertically
  (same component, `orientation="vertical"`), expanded row shows the cards, `Open day ›` in the
  expanded header zooms in.
- **Week · Grid** keeps the stacked project cards with 7 mini cells. The lens toggle stays visible;
  the scope `kbd` chips are hidden.
- **Month** keeps the heat navigator (it is 7 cells wide, it fits) with the bands stacked.
- Row 1 collapses to: scope control (full width, `size="sm"`) with `⊖ ⊕` hidden; the two actions
  move to the FAB (`+`) and the timer pill in the app header that already exists on every page.
- Swipe left / right on the content steps the period, same slide as `‹ ›`. Horizontal swipe is not
  claimed on the Grid lens because its cells scroll horizontally.

---

## 10. State and URL

`?scope=day|week|month` · `?lens=agenda|grid` · `?day=YYYY-MM-DD` (anchor, unchanged) ·
`?week=` stays as the server's fetch key. Written through `history.replaceState` via
`use-history-param.ts` as today. `?zoom=` is accepted and mapped for old links and bookmarks.
Remembered preferences in `localStorage`: `time-scope` and `time-lens` (replacing `time-zoom`).

The only new server need is the heat navigator: per-day totals for the visible month(s), a small
aggregate riding along with the month payload that already ships (`app/time/page.tsx`). Nothing else
in this document needs a query, a schema change or a migration.

---

## 11. Accessibility contract

Kept: one `h1`, landmarks, one `region` per weekday named `Monday`…`Sunday` in Week scope,
`Add entry on Monday` in every column, `Edit <description>` / `Delete <description>` scoped inside
their day region, `radiogroup` for the view control, `aria-live="polite"` announcement on every
scope, lens or period change, zero axe violations.

Changed, deliberately, so the aria baselines in `e2e/__aria__/` must be regenerated with the diff
read:

- The view `radiogroup` is named `View`, with three radios. A second `radiogroup` `Week layout`
  appears in Week scope.
- `Days of this week` (`group`) exists in Day scope and on mobile, not in desktop Week scope. Its
  buttons keep `Select Monday` and `aria-pressed`.
- Week column headers become buttons, `Open Monday, Aug 31`, inside the weekday region.
- `⊖ ⊕` are buttons with state-dependent names; `Today` is `aria-disabled` when at today.
- The heat navigator is a `grid` of `gridcell` buttons named `Tuesday, September 1, 6.5 hours`
  (or `nothing logged` / `future`), with `row` headers `Week 36`.
- Card actions revealed on hover must also be reachable by keyboard: `:focus-within` reveals them,
  and they are always in the tab order (visibility is opacity, never `display: none`).
- The shortcut sheet is a `Dialog` with a `table`. The one-time hint is a toast, `role="status"`.

---

## 12. i18n scope

Removed: `TimeTracking.zoom.keyboardHint`, `keyboardHintPeriod`, the `Assigned` label.

Added (both locales, `TimeTracking` namespace):

| Key                              | EN                                                     | HU                                                            |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `view.label`                     | View                                                   | Nézet                                                         |
| `view.zoomIn` / `zoomOut`        | Zoom in to {scope} · Zoom out to {scope}               | Közelítés: {scope} · Távolítás: {scope}                       |
| `lens.label`                     | Week layout                                            | Heti elrendezés                                               |
| `lens.agenda` / `lens.grid`      | Agenda · Grid                                          | Napló · Rács                                                  |
| `period.week`                    | Week {week} · {range}                                  | {week}. hét · {range}                                         |
| `period.today`                   | Today                                                  | Ma                                                            |
| `period.previous` / `next`       | Previous {unit} · Next {unit}                          | Előző {unit} · Következő {unit}                               |
| `total.today` / `week` / `month` | {hours} today · {hours} this week · {hours} this month | {hours} ma · {hours} ezen a héten · {hours} ebben a hónapban  |
| `total.overTarget`               | over {target}                                          | több mint {target}                                            |
| `header.open`                    | Open {date}                                            | {date} megnyitása                                             |
| `heat.cell`                      | {date}, {hours}                                        | {date}, {hours}                                               |
| `heat.empty` / `heat.future`     | {date}, nothing logged · {date}, in the future         | {date}, nincs rögzítve · {date}, jövőbeli                     |
| `heat.workdays`                  | {logged} of {workdays} workdays                        | {logged} / {workdays} munkanap                                |
| `composer.title`                 | Add to {date}                                          | Hozzáadás: {date}                                             |
| `composer.description`           | What did you do?                                       | Min dolgoztál?                                                |
| `composer.more`                  | More options                                           | További beállítások                                           |
| `card.continue`                  | Continue {description}                                 | {description} folytatása                                      |
| `undo.deleted` / `undo.action`   | Entry deleted · Undo                                   | Bejegyzés törölve · Visszavonás                               |
| `empty.copyYesterday`            | Copy yesterday                                         | Tegnapi másolása                                              |
| `shortcuts.title` + rows         | Keyboard shortcuts …                                   | Billentyűparancsok …                                          |
| `hint.firstVisit`                | Press ? for shortcuts, or click a day to open it       | A ? gomb mutatja a parancsokat, egy napra kattintva megnyílik |

Date and week-number formatting goes through `src/lib/formatting` so `Intl` stays the single
authority; no template contains locale logic.

---

## 13. Component inventory

| Component                          | Change                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ui/SegmentedControl`              | `shortcut?: string` per item; sliding `layoutId` thumb behind the radios (opt-in `indicator="slide"`)                                |
| `sheet/TimeScopeBar` **new**       | composes scope control + `⊖ ⊕` caps + lens toggle + the two actions; owns the shortcut handler wiring                                |
| `sheet/PeriodNavigator` **new**    | `‹ label › Today` + `⋯` menu; unit-aware labels; direction-aware label slide; label opens `MonthPicker`                              |
| `sheet/PeriodTotal` **new**        | the settling figure with status icon + label                                                                                         |
| `sheet/DayRibbon` **new**          | extracted from `TimeZoomShell`; horizontal and vertical orientations; carries `day-<iso>` ids                                        |
| `sheet/DayColumnHeader` **new**    | shared by `WeekAgenda` and the Grid lens; button; capacity bar; `day-<iso>` id                                                       |
| `sheet/MonthHeatNavigator` **new** | the month grid of days; `grid` semantics; cells carry `day-<iso>` ids                                                                |
| `sheet/QuickEntryComposer` **new** | popover / bottom-sheet composer; reuses `TimeEntryForm` field pieces and the duration parser                                         |
| `sheet/ShortcutSheet` **new**      | `Dialog` with the shortcut table                                                                                                     |
| `sheet/WeekAgenda`                 | uses `DayColumnHeader`; hover-reveal card actions; contextual empty states; footnote handoff                                         |
| `sheet/DayAgenda`                  | two-column layout with the summary rail; wraps descriptions                                                                          |
| `sheet/MonthOverview`              | slot for `MonthHeatNavigator` above the bands; ghost-row link targets                                                                |
| `layout/CommandPalette`            | time command group                                                                                                                   |
| `app/time/TimeZoomShell`           | scope/lens state instead of level; strip removed from persistent chrome; `LayoutGroup id="time"`                                     |
| `app/time/zoom.ts`                 | `scope` + `lens` types, legacy `zoom` mapping, new shortcut table                                                                    |
| Retired                            | inline keyboard legend; `Assigned` chips; toolbar quick-action row; full-size `RunningTimerCard`; `DayDetailPanel` (already settled) |

Each new component follows `src/components/README.md`: folder, `.types.ts`, `.variants.ts`,
`index.ts`, stories for variants / empty / locked / dark / light / mobile, a `play` test for the
thumb and the composer.

---

## 14. Phasing

Each phase is a branch off `develop` and shippable alone. The order front-loads what the screenshot
complains about.

| Phase  | Content                                                                                                                                                                                                                                                                                      | Ships value alone                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **R0** | Scope × lens model, URL mapping, `TimeScopeBar` with `⊖ ⊕` + `kbd` chips + sliding thumbs, `PeriodNavigator` with unit-bound arrows and `Today`, `PeriodTotal`, legend removed, strip removed from desktop Week, `DayColumnHeader` as buttons, `J`/`K`. **No new motion beyond the thumbs.** | Yes: the two rows of chrome, the fixed navigation |
| **R1** | Container transform Week ⇄ Day, shared-axis steps, re-lens crossfade, settling figures, timer morph, saved pulse, new tokens                                                                                                                                                                 | Yes: the fluidity                                 |
| **R2** | Quick composer, contextual quick actions, hover-reveal card actions with Continue, undo delete, `N` / `S`                                                                                                                                                                                    | Yes: faster entry                                 |
| **R3** | `MonthHeatNavigator` + the per-day month aggregate, Month → Day / Week transforms, workday count                                                                                                                                                                                             | Yes: forgotten days visible                       |
| **R4** | Shortcut sheet, palette commands, first-visit hint, mobile ribbon / FAB / swipe, aria baselines regenerated, QA scenarios, visual baselines                                                                                                                                                  | Closes the redesign                               |

R0 alone resolves symptoms 1–8 of §1. R1 is what makes it feel like one place.

---

## 15. Open decisions

Recommendations included.

1. **Grid as a lens rather than a level.** _Recommend yes._ It restores the axis invariant and it is
   the model users already hold. This re-opens §5 of the axis doc; the code change is a type and a
   URL mapping, not a data change.
2. **Arrows step a day in Day scope.** _Recommend yes._ Every calendar behaves this way; the week
   fetch on boundary crossing is the same one that happens today.
3. **The strip leaves desktop Week.** _Recommend yes._ The continuity contract's real content
   (selected day, totals, focus, scroll) is untouched; only the "never unmounts" clause goes, and it
   is replaced by something stronger, a shared element that shows where the day went.
4. **Figures settle, never roll.** _Recommend keep the no-roll rule_ with the one-step settle. A
   count-up is the single most requested "more animation" item and the single easiest way to make a
   timesheet look approximate.
5. **`Esc` zooms out one step.** _Recommend yes_, only when no overlay is open and focus is not in
   an input; it is the ZUI convention and costs nothing. Counter-argument: users pressing `Esc`
   reflexively after closing a dialog might zoom out by accident. Mitigation: ignore `Esc` for 300 ms
   after an overlay closes.
6. **`J`/`K` as the primary step keys.** _Recommend yes_, brackets kept as aliases; verify `−`/`+`
   on the HU layout in the same pass.
7. **Default scope on mobile is Day.** _Recommend yes._ The week accordion is a scanning view; the
   day list is where entries get made on a phone.
8. **The `+` opens the composer, not the modal.** _Recommend yes_, with `More options` one click
   away. Drafts autosave already exists for the modal; the composer should reuse it so a half-typed
   entry survives a stray click.
9. **Heat navigator intensity.** _Recommend four steps of the mint ramp_ plus hollow / dotted /
   ring states, not a binary "logged or not". The point is to see a 2 h day next to an 8 h day.
10. **Drag a card to another day.** _Recommend still no_ (rejected in §14 of the axis doc). The
    composer and Continue cover the need with less risk around locked periods.

---

## 16. Inspiration and sources

Product patterns:

- Notion Calendar (Cron): number keys set visible days, `D`/`W`/`M` views, `T` today, `J`/`K`
  step by the current view's unit, mini-calendar changes the date and never the view.
  https://www.notion.com/help/notion-calendar-keyboard-shortcuts
- Google Calendar: `D`/`W`/`M`/`Y`, `T`, `J`/`K` and `N`/`P`, the Today button's "you are here"
  state. https://support.google.com/calendar/answer/37034
- Fantastical: modifier + arrow moves dates, mini calendar as navigator.
  https://flexibits.com/fantastical/help/keyboard-shortcuts
- Vimcal: single-letter views, `G` to jump, `C` to create. https://www.vimcal.com/
- TrackingTime: persistent month mini-calendar with hours-per-day icons beside the day view.
  https://trackingtime.co/
- Toggl Track: favourites bar for one-tap prefilled entries, timer as the first row of today,
  `Shift+?` shortcut sheet. https://toggl.com/blog/favorites-feature ·
  https://support.toggl.com/are-there-any-keyboard-shortcuts
- Harvest week grid for bulk entry (the Grid lens precedent).
  https://support.getharvest.com/hc/en-us/articles/360048687531
- Clockify week templates (the Duplicate last week precedent).
  https://clockify.me/help/track-time-and-expenses/timesheet-view
- Everhour: hover-revealed start-timer on an entry.
  https://support.everhour.com/article/128-time-tracking-methods
- Toggl Goals: daily target as a ring with state.
  https://support.toggl.com/en/articles/9674851-time-tracking-goals
- Apple Photos and Apple Calendar: semantic zoom Years → Months → Days, the container-transform
  precedent. https://support.apple.com/en-us/guide/photos/pht56eafa987/mac

Design guidance:

- Material Design 3 motion: container transform and shared axis.
  https://m3.material.io/styles/motion/transitions/transition-patterns
- Apple HIG Motion: 100–500 ms, brevity, spatial sense, reduce motion.
  https://developer.apple.com/design/human-interface-guidelines/motion
- Apple HIG Segmented controls: segments switch views of the same content.
  https://developer.apple.com/design/human-interface-guidelines/segmented-controls
- Emil Kowalski, animations.dev standards: under 300 ms, ease-out, never ease-in, spring values.
  https://github.com/emilkowalski/skills/blob/main/skills/review-animations/STANDARDS.md
- Rauno Freiberg, Invisible Details of Interaction Design: spatial memory, motion establishes
  relationships. https://rauno.me/craft/interaction-design
- Radix Themes Segmented Control (sliding indicator pattern).
  https://www.radix-ui.com/themes/docs/components/segmented-control
- Motion docs: layout animations, `AnimatePresence`, springs, reduced motion.
  https://motion.dev/docs/react-layout-animations · https://motion.dev/docs/react-animate-presence
  · https://motion.dev/docs/react-transitions · https://motion.dev/docs/react-accessibility
- NN/g on empty states as teachable moments.
  https://www.nngroup.com/articles/empty-state-interface-design/
- MDN `prefers-reduced-motion` and WCAG 2.3.3.
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
