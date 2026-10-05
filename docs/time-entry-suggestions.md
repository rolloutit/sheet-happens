# Time Entry Suggestions — Recalled Descriptions, and the Quality-of-Life Slate Behind Them

**Status:** implemented (Part A) · this document is now both the plan and the record — §20 lists
the two places the build deviated from it, and why
**Surface (Part A):** `/time` — `app/time/TimeGridClient.tsx`, `app/time/EntryModal.tsx`,
`src/components/sheet/QuickEntryComposer`, `src/components/sheet/TimerStartDialog`,
`src/server/time-tracking/time-entries.ts`, `src/server/time-tracking/context.ts`
**Relationship to other docs:** Part A is the full design for **A4** of
`docs/time-tracking-ux-upgrades.md` (the one item of that doc's "quick wins" section still
unbuilt). Part B replaces the rest of that doc's backlog, which has largely shipped — §17 says
what, so the slate in §18 is a fresh one. Nothing here changes the data model in
`docs/domain-model.md`, and nothing here writes.

---

# Part A — Description suggestions

## 0. In one paragraph

Every other kind of memory on `/time` is already preloaded with the page: the assigned projects,
the recent projects behind the composer's chips, the month totals for both months the week touches,
even a half-typed draft that survived a reload. The **description** — the one field a member
retypes several times a week, and the only entry field that reaches a report line and a contractor
invoice verbatim — has no memory at all. It is a bare `<input>` in the composer, a bare `<textarea>`
in the entry dialog and the timer dialog, all three with `autoComplete="off"`. This proposal ships
the member's own recent descriptions **inside the existing `/time` payload**, ranked by
recency-weighted frequency and scoped to the project chip that is selected, and puts them behind one
new primitive (`SuggestInput`) that turns those three fields into WAI-ARIA comboboxes: focus an
empty field and the top few appear with no keystroke at all; type three letters and the list
filters, accent-insensitively, for a Hungarian keyboard. No schema change, no migration, no new
round-trip, no writes, and no automatic filling — a suggestion is only ever accepted by an explicit
Enter or click.

## 1. The gap, precisely

Grounded in the current code, not in a guess about it.

| #   | Fact today                                                                                                                                                                                                    | Where                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | The composer's description is an `Input` with `autoComplete="off"` and no suggestion surface.                                                                                                                 | `QuickEntryComposer.tsx` (description field)                          |
| 2   | The entry dialog's description is a plain `<textarea rows={3}>`.                                                                                                                                              | `app/time/EntryModal.tsx:356`                                         |
| 3   | The timer dialog's description is a plain `Input`, blank on every open by design (the portal unmount is the reset).                                                                                           | `TimerStartDialog.tsx:60`                                             |
| 4   | The page already preloads a 90-day memory — but only of **which projects**, never of what was done on them. `recentEntries` selects `projectId` and throws the description away.                              | `time-entries.ts:468`                                                 |
| 5   | Typing a duration into an empty grid cell opens the dialog with `prefill: true`, duration filled, **description empty** — the single most predictable "now type the thing you always type" moment in the app. | `TimeGridClient.tsx:785`                                              |
| 6   | Description text is not cosmetic: report lines persist it and admin edits of it are tracked, so inconsistent wording for the same work is a reporting problem, not just a typing cost.                        | `src/server/reports/report-line-persistence.ts`                       |
| 7   | An entry can carry an empty description (`description String @default("")`), and the grid flags that cell rather than fixing it — `needsDescription` has no one-click remedy.                                 | `prisma/time-tracking.prisma:11`, `app/time/time-entry-helpers.ts:67` |
| 8   | The MCP `time_get_context` tool tells an agent the projects, the locks and today's date — but not how this member words their work, so an agent invents phrasing the member never uses.                       | `src/server/time-tracking/context.ts`                                 |

So the gap is not "add an autocomplete". It is that the app has a memory architecture — preloaded,
member-scoped, 90 days, revalidated on every mutation — and the description field is the one thing
left outside it.

## 2. Principles, and the non-goals that matter more

1. **Preloaded, not fetched.** Suggestions ride the `/time` payload like `recentProjects` and the
   month overviews do. A member who opens the composer 40 times a week must not pay 40 round-trips
   for a list that changes when they log an entry — and an entry log already
   `revalidatePath("/time")`s, so the list is never stale by more than one mutation.
2. **A suggestion is advice, never an autofill.** The field stays free text. Nothing is inserted
   without an explicit Enter on a highlighted option or a click. There is no inline "ghost
   completion" of the rest of the string, no first-option-preselected, and no
   accept-on-blur — because the cost of a wrong description is a wrong invoice line, and a member
   who was mid-sentence must never find their sentence replaced.
3. **Scoped to the selected project.** The chip that is selected in the composer, or the project in
   the dialog's `Combobox`, decides the list. Changing the project re-scopes the list and keeps the
   typed text.
4. **The member's own history only.** Never another member's descriptions, at any aggregation, ever.
   Not a preference, a construction: `memberId` is the first clause of the `where` and there is no
   parameter that widens it (the same rule `queries.ts` states for `listMemberTimeEntries`).
5. **No new state.** No favourites table, no cache table, no counter column, no migration. The
   suggestion list is a derived read over `time_entries`, which is what makes it correct by default
   after an edit, a delete, an undo, or an admin correction.
6. **Read-only by construction.** No audit entry, because nothing is written. Period locks are
   irrelevant to it: a locked month's descriptions are still this member's own words and reading
   them back changes nothing.

Non-goals: generating descriptions with a model; cross-member "team phrasing"; a task or tag layer
(§14); anything that changes what a submitted revision contains.

## 3. What a suggestion is

```ts
export type DescriptionSuggestion = {
  /** Exactly as it was last typed, trimmed. Never re-cased, never re-worded. */
  text: string;
  projectId: string;
  /** Distinct entries in the window that used this text on this project. */
  useCount: number;
  /** `YYYY-MM-DD` — the most recent entry that used it, for the meta line and the ranking. */
  lastUsedOn: string;
};
```

### 3.1 Source rules

Included: the member's own `TimeEntry` rows with `deletedAt: null`, `source` **not** `DECLARED`, a
non-empty `description`, inside the window of §3.2.

`DECLARED` is excluded for the same reason `recentProjects` excludes it (`time-entries.ts:471`): a
declared month is one 52-hour row on the 1st whose text is a declaration note, not a description of
work, and offering it in a composer that cannot even write to that project is a contradiction the
member sees before we do.

Deleted rows are excluded, which means the six-second undo window behaves correctly for free: the
delete removes it from the list, `restoreTimeEntry` puts it back.

### 3.2 The window is anchored to the visible week, not to today

`localDate` between `weekEnd − 90 days` and `weekEnd`, where `weekEnd` is the **visible** week's
end — the same anchor and the same 90 days `recentProjects` already uses.

Two reasons, one product and one testing:

- Browsing to March and adding a forgotten entry should suggest what you were writing **in March**.
  Anchoring to today would suggest this week's words for a week you have no memory of, which is the
  failure Toggl users filed as a bug when their autocomplete only offered the current week.
- It makes the e2e assertion deterministic. The frozen week (`2025-03-03`) sits outside the dev
  generator's `ENTRY_MONTHS_BACK = 12` window, so the anchored window over the frozen week contains
  the frozen entries and nothing else. See §12.4 for the invariant and how to assert it safely.

The window includes the visible week itself, so a description typed on Monday is suggested on
Thursday.

### 3.3 Normalization, and the dedupe key

`Sprint planning`, `sprint planning` and `Sprint  planning` are one suggestion, not three.

- **Dedupe key**: `text.trim().replace(/\s+/g, " ").toLocaleLowerCase("hu")`. Hungarian rather than
  the default locale so `İ`-style surprises stay out; the key never reaches a screen.
- **Displayed text**: the variant from the **most recent** entry, so a member who deliberately
  re-cased their wording last week sees last week's casing.
- **Counts merge** across the variants of one key.

### 3.4 Ranking

One score, deterministic, and computed against the window's anchor rather than `Date.now()` so the
same week always ranks the same way (and so the tests need no clock):

```
recency = 0.5 ** (daysBetween(lastUsedOn, anchor) / SUGGESTION_HALF_LIFE_DAYS)   // 14 days
score   = useCount * recency
```

Tie-breaks, in order: `lastUsedOn` desc, `useCount` desc, then code-unit `text` compare — a total
order, so the list cannot wobble between renders (the same reasoning `queries.ts` gives for its
cursor).

Why a half-life rather than plain "most recent first": a description used 30 times over two months
is what this member logs; one used once yesterday is not. Why not plain frequency: someone who
finished a project last quarter should not have it at the top all quarter. Fourteen days is a
sprint, and is the single number in this feature worth tuning later (§15).

### 3.5 Caps

| Cap                          | Value | Why                                                                          |
| ---------------------------- | ----- | ---------------------------------------------------------------------------- |
| `SUGGESTION_LOOKBACK_DAYS`   | 90    | Matches `recentProjects`; matches what Toggl's own history surface offers.   |
| `SUGGESTION_HALF_LIFE_DAYS`  | 14    | A sprint.                                                                    |
| `SUGGESTIONS_PER_PROJECT`    | 12    | The panel shows at most 6 at a time; 12 leaves room for filtering to bite.   |
| `SUGGESTIONS_PER_PAYLOAD`    | 96    | 8 projects × 12. A hard stop so a 20-project member cannot inflate the page. |
| `SUGGESTION_TEXT_MAX_LENGTH` | 160   | A longer description is **excluded**, not shortened — see §20.1.             |

Only projects that are in the week's `projects` list get suggestions: the chips are the only place a
suggestion can be used, so a project with no chip contributes nothing but bytes.

### 3.6 The query

One `groupBy`, added to the `Promise.all` in `getMemberWeeklyTimeGrid`:

```ts
prisma.timeEntry.groupBy({
  by: ["projectId", "description"],
  where: {
    memberId: member.id,
    deletedAt: null,
    source: { not: "DECLARED" },
    description: { not: "" },
    localDate: { gte: addDays(weekEnd, -SUGGESTION_LOOKBACK_DAYS), lte: weekEnd },
  },
  _count: { _all: true },
  _max: { localDate: true },
});
```

Notes that matter:

- **No `projectId: { in: … }` clause**, deliberately. The assigned projects are loaded in the same
  `Promise.all` and are therefore not yet known — exactly the situation `recentEntries` is already
  in, and it solves it the same way: read member-and-window-bounded, then intersect against
  `projectsById` on the way out. Adding the filter would serialize a parallel read to save a filter
  step over a few hundred rows.
- **No `orderBy`/`take` in the database.** Ranking and capping happen in a pure function, which is
  what makes them testable with a plain array and no Prisma (the pattern `buildMonthOverview` and
  `summarizeMemberTime` already set).
- **No new index.** `@@index([memberId, localDate])` already covers the selective part of the
  `where`; the group is over at most a few hundred rows for one member and 90 days.

## 4. Where the code goes

```txt
src/server/time-tracking/
  description-suggestions.ts        ← new: types, constants, buildDescriptionSuggestions()
  description-suggestions.test.ts   ← new: ranking, dedupe, caps, anchor arithmetic
  time-entries.ts                   ← one more read in the Promise.all, one more payload field
  context.ts                        ← the same list for MCP (§10)
  index.ts                          ← barrel exports
src/lib/
  text-search.ts                    ← new: foldForSearch(), index-preserving accent folding
  text-search.test.ts
src/components/ui/SuggestInput/     ← new primitive (§6.1)
app/time/
  EntryModal.tsx · TimeGridClient.tsx   ← wire it; no logic of their own
messages/{hu,en}.json               ← §9
```

`buildDescriptionSuggestions` is pure: `(rows, { anchor, projectIds }) => DescriptionSuggestion[]`.
The narrow client type for the one read it needs (`DescriptionSuggestionClient`, the shape
`TimeEntryQueryClient` and `TimeSummaryClient` established) lets a test hand over a plain object and
stops a second query being added here quietly.

Business logic stays in `src/server/time-tracking` — so the MCP toolset and the page get the same
list from the same function, which is the rule that keeps an agent and the grid from contradicting
each other.

## 5. Payload

`TimeGridWeek` grows one field:

```ts
/** The member's own recent descriptions, per project, ranked. Advice for the composer; never
 *  written back, never another member's. */
descriptionSuggestions: DescriptionSuggestion[];
```

A flat array rather than a map keyed by project: it serializes smaller, the client already groups by
project id for the chips, and a map would tempt a consumer into treating a missing key as "no
project".

Budget: 96 rows × (≤160-char text + three small fields) ≈ 12–18 KB uncompressed worst case, a few KB
typical. The page already carries a week of entries and up to two month overviews; this is the
smallest of the three. Cheap insurance: `SUGGESTIONS_PER_PAYLOAD` is a constant, and §12.5 measures
the real number against a fat fixture rather than trusting this paragraph.

## 6. The interaction

### 6.1 `SuggestInput` — the new primitive

Neither existing control fits. `Combobox` is select-from-a-closed-set: its value must be an option,
it has no free-text value, and it renders a button trigger, not a field. `Command` is a palette. What
these three fields need is the WAI-ARIA **editable combobox with a listbox popup**: the typed text is
the value, the list is optional help.

```txt
Component: src/components/ui/SuggestInput/
  SuggestInput.tsx         "use client"
  SuggestInput.types.ts    props, labels, SuggestOption
  SuggestInput.stories.tsx variants · empty · no-match · disabled · error · mobile · both themes
  SuggestInput.test.tsx    keyboard arbitration, accent matching, Escape ordering
  index.ts
```

Props, in the house idiom (typed variants, callbacks report intent, no persistence):

| Prop                           | Meaning                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `value` / `onValueChange`      | The free text. Controlled, so the composer can carry it into the dialog and the draft. |
| `options`                      | `{ text, meta?, group? }[]` — already ranked and scoped by the caller.                 |
| `onAccept(option)`             | Fired on Enter/click **only**. The caller sets the value; the primitive never does.    |
| `as`                           | `"input" \| "textarea"` — the dialog's field is three rows tall.                       |
| `emptyStateLimit`              | How many to show on focus with an empty field (§6.5). `0` disables the behaviour.      |
| `labels`                       | Every string, as everywhere else in `src/components`. No `useTranslations` inside.     |
| `disabled` `invalid` `pending` | Binary states stay booleans.                                                           |

Keyboard contract — the part worth arguing about now rather than in review:

| Key                    | List closed                                 | List open                                                         |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| typing                 | opens the list if anything matches          | refilters; **no option becomes active on its own**                |
| `↓` / `↑`              | opens the list (empty field ⇒ the top few)  | moves the active option; wraps                                    |
| `Enter`, active option | —                                           | accepts it, closes, keeps focus in the field, **does not submit** |
| `Enter`, no active     | native (composer submits; textarea newline) | closes the list, then native on the **same** press                |
| `Esc`                  | propagates (the dialog closes, as today)    | closes the list and `stopPropagation()` — the dialog stays open   |
| `Tab`                  | native                                      | closes the list **without** accepting, then native                |
| `Home`/`End`           | native caret movement                       | native caret movement (not list navigation)                       |

Two of those rows are the whole reason to write this down. "Enter with an active option does not
submit" is what stops a member half-picking a suggestion and finding an entry logged. "Escape closes
the list, not the dialog" needs a real `stopPropagation` inside the field, because both the entry
dialog's own `useModalFocusTrap` and Radix's `onEscapeKeyDown` in the timer dialog are listening
above it.

Mobile (`< lg`, via the existing `use-media-query`): the list renders as a block **below** the
field instead of a floating popover, capped at 4 rows, with no hover styling and a 44px row height.
The composer is already a bottom sheet there; a popover over a virtual keyboard is a trap.

### 6.2 Quick composer

The description `Input` becomes a `SuggestInput`. Options come from
`descriptionSuggestions` filtered to `value.projectId`. `QuickEntryComposerProps` grows
`suggestions` and the labels; the composer keeps validating on submit and keeps calling `onSubmit`
only with a value that passed — accepting a suggestion is an ordinary value change as far as it is
concerned.

The draft autosave in `TimeGridClient` (`saveTimeEntryDraftAction`, keyed on the description) sees an
accepted suggestion as typing, which is correct: pick a suggestion, get distracted, come back to it.

### 6.3 Entry dialog

Same swap, `as="textarea"`. Two dialog-specific behaviours:

- **The prefill moment.** Opened from a grid cell with `prefill: true` and an empty description, the
  list opens on mount with the top suggestions for that project already visible — the one place in
  the app where the member's next keystroke is genuinely predictable (§1, fact 5). Nothing is
  inserted; the list is just already open.
- **Project changes re-scope, text survives.** Changing the `Combobox` re-filters the list; the typed
  description is untouched.

### 6.4 Timer dialog

Same swap. This closes the second half of **C2** of the old doc: `TimerStartDialog` already offers
recent _projects_, and now offers the descriptions that go with them, so restarting yesterday's task
from the dialog stops being a retype. Rendered with `emptyStateLimit` on, because the dialog opens
blank by design.

### 6.5 The zero-keystroke state — the "preload" the user actually feels

Focus an empty description field and the list opens with the top `emptyStateLimit` (4 in the
composer and the timer dialog, 6 in the dialog) suggestions for the selected project, under a
`Recent` group heading — the existing `labels.recent` string. This is the difference between "an
autocomplete" and "the app remembers": for the common case the interaction is focus, `↓`, `Enter`.

If the project has fewer than three suggestions, and only then, a second group appears —
`From other projects`, at most three, taken from the same payload — so a member's first week on a
new assignment is not a blank field. Cross-project text can name the wrong client, so this group is
always visibly grouped, never merged into the primary list, and is the first thing to switch off if
it reads as noise (§15).

### 6.6 An empty description on an existing entry

A `Description needed` warning should be one gesture to fix, not a memory test. **As built** (§20.2)
that fix lives in the entry dialog rather than in a second editable surface: opening an entry whose
description is empty focuses the description and offers the list, so `Edit` → `↓` → `Enter` →
`Save` is the whole repair. Locked entries stay read-only exactly as they are now.

## 7. Freshness

Every mutating action on `/time` already calls `revalidatePath("/time")`, so the server payload
re-derives the list after each create, update, delete, restore, copy and duplicate. That gets
"typed once, suggested next time" with no cache to invalidate and no counter to keep in step.

The one visible gap is within a single page session: a description typed into the composer at 09:00
is not in the list the composer shows at 09:05 until a revalidate lands. `TimeGridClient` closes it
by merging what it just submitted into the list it hands down — a session-local array of
`{ projectId, text }`, ranked to the top, dropped on the next payload. Client-side only, no server
concept of a "pending suggestion".

## 8. Accessibility contract

Following the existing `/time` contract (`docs/time-view-redesign.md` §11) and the WAI-ARIA
combobox pattern:

- The field keeps its own label and adds `role="combobox"`, `aria-expanded`, `aria-controls`,
  `aria-autocomplete="list"`, and `aria-activedescendant` pointing at the active option's id. The
  list is a `listbox` of `option`s with `aria-selected` on the active one.
- **Focus never leaves the field.** Arrow keys move `aria-activedescendant`, not focus — which is
  what keeps the entry dialog's focus trap and the Radix dialogs from fighting the list.
- One `aria-live="polite"` region, announcing the **result count** on a debounce (`3 suggestions`),
  never the option text — the active option is already announced through `aria-activedescendant`,
  and doubling it is the classic combobox screen-reader spam.
- Accepting announces nothing: the value changed, and the field's own text is the readout.
- Every option is a real `option` element with a stable id; the meta line (`12 times · last Sep 3`)
  is inside the option, so it is part of the accessible name rather than a hover-only detail.
- Group headings are `role="presentation"` labels referenced by `aria-labelledby` on grouped
  option sets, so `From other projects` is heard, not just seen.
- `prefers-reduced-motion`: the list appears with no transition (the tokens in `src/lib/motion.ts`
  already gate this).
- `autoComplete="off"` stays — the browser's own history dropdown over our listbox is the one
  overlap that would make this worse than nothing.

## 9. i18n

New keys under `TimeTracking.suggestions` in **both** `messages/hu.json` and `messages/en.json`:

| Key           | EN                                                                        |
| ------------- | ------------------------------------------------------------------------- |
| `label`       | `Recent descriptions` (the listbox's accessible name)                     |
| `recentGroup` | `Recent`                                                                  |
| `otherGroup`  | `From other projects`                                                     |
| `meta`        | `{count, plural, one {# time} other {# times}} · last used {date}`        |
| `count`       | `{count, plural, one {# suggestion} other {# suggestions}}` (live region) |
| `empty`       | `No matching description`                                                 |
| `hint`        | `↑↓ to choose · ↵ to insert`                                              |

Two rules for this feature specifically:

- **Suggestion text is user data and is never translated**, never localized, never
  sentence-cased. It is echoed back exactly as stored.
- `date` in `meta` goes through `src/lib/formatting` like every other date, so `Intl` stays the one
  authority and the Hungarian short date is not hand-built.

The MCP addition in §10 stays English-only, per the single documented exception in `CLAUDE.md`.

## 10. MCP

`getMemberTrackingContext` gains, per project:

```ts
/** Up to 5 of this member's own recent descriptions on this project, most useful first. */
recentDescriptions: string[];
```

No new tool, no new scope, no second code path — the same
`buildDescriptionSuggestions`, capped tighter because a context response is a prompt, not a panel.
The `time_get_context` argument and result descriptions gain one English sentence saying these are
the member's own past wording and should be reused rather than paraphrased.

Why this is worth the tokens: an agent that logs "worked on the API" for a member whose 30 previous
entries say "API endpoint implementation" produces a report line that reads as an outlier and a
timesheet reviewer's question. Consistency here is the same value the human autocomplete delivers,
for the same cost, and `docs/mcp-server.md` gets a line under its context-tool section.

## 11. Privacy and safety

- Member-scoped by construction (§2.4). No admin surface reads this; the admin declared-hours and
  timesheet screens are unchanged.
- Nothing new is written, so no audit rows, no `updatedByMemberId`, no locked-period interaction.
- Suggestion text is user content: it must not appear in server logs or error messages. An absent or
  empty list degrades to exactly today's behaviour — a perfectly usable text field — which is what
  makes this safe to add to a payload the page cannot render without. The read itself is not wrapped
  in a `catch`: it is one indexed `groupBy` inside the same `Promise.all` as the week's entries, so
  anything that fails it fails them too, and swallowing it would only hide that.
- Admin-modified descriptions are included: the row is still this member's entry, and the corrected
  wording is the wording an admin wants to see next month.

## 12. Verification

### 12.1 Unit (`pnpm test`)

`description-suggestions.test.ts` — dedupe across case and whitespace variants with the recent
casing surviving; `DECLARED` and empty descriptions excluded; the half-life ordering pinned with a
fixed anchor (frequency beats a single recent use, a stale favourite falls below a current one); the
total order proven stable by shuffling the input; caps applied per project and per payload;
over-long descriptions dropped rather than shortened; projects with no chip dropped.

`text-search.test.ts` — accent folding both ways for `á é í ó ö ő ú ü ű` (typing `arajanlat` finds
`Árajánlat`), prefix matches ranked above mid-word ones, and the index map holding so the highlight
lands on the right characters in the **unfolded** string. This is the one piece of arithmetic in the
feature that will silently produce a wrong-looking highlight rather than a failure, so it gets its
own tests.

### 12.2 Component (`pnpm test-storybook`, `pnpm test:visual`)

`SuggestInput` stories cover: closed; open with matches and a highlighted substring; the
zero-keystroke state; no-match; grouped cross-project; disabled; invalid; the textarea form; the
mobile block layout; and both themes (`:root` is dark, `.light` overrides — check both).
A `play` test drives the keyboard table in §6.1 key by key, including the two rows that exist to
prevent bugs: Enter-with-active does not submit, and Escape closes the list without closing the
dialog.

New stories add new `-darwin` baselines rather than changing existing ones, so
`pnpm test:visual:update` is expected here, and the commit says so.

### 12.3 Browser sanity (`pnpm exec playwright cli`)

`/time` on `localhost`, admin session, frozen week: open the composer, read the accessibility tree
back, confirm the combobox/listbox/option names and that the active option is reported through
`aria-activedescendant`. The tree is the check; no screenshots needed.

### 12.4 e2e (`pnpm e2e`)

A spec in `e2e/authenticated/` (both roles) on `FROZEN_WEEK_PATH`: open the composer for a frozen
day, type `spr`, expect the option `Sprint planning`, accept it with Enter, assert the field holds
it and that **no entry was created**; then Enter again and assert it was.

The determinism argument, so nobody has to re-derive it: the frozen week starts `2025-03-03`, the
anchored window is `2024-12-08 … 2025-03-09`, and the dev generator only fills from
`monthStart(today − ENTRY_MONTHS_BACK = 12)` — today's 2025-09-01 — forward. The two cannot
intersect, and the gap only widens as time passes. Even so the spec asserts **containment** (this
option is present) rather than the exact list, and any literal it names comes from `FROZEN_WEEKS`,
never from generated data. The aria baseline in `e2e/__aria__/time-week.spec.ts` needs a re-read, not
a regeneration, if the composer's tree changes.

### 12.5 Performance

**As built:** a unit test feeds `buildDescriptionSuggestions` 1,800 rows — twelve projects × 150
distinct descriptions, every one at the 160-character ceiling — and asserts the result is 96 rows,
that no project exceeds `SUGGESTIONS_PER_PROJECT`, and that the serialized payload stays under
32 KB. That is the worst case by construction; real descriptions are a fraction of the length cap.
The point is the cap, not the timing — a number in a test is what stops the payload growing quietly.

One thing the test taught: when scores are comparable across projects the payload cap spreads its 96
slots over **all** of them rather than filling up on the first few, so a member on twenty projects
still gets suggestions everywhere. Only the per-project ceiling is a guarantee.

### 12.6 QA plan

A scenario appended to `docs/manual-qa-test-plan.md`, committed separately as `docs(qa): …` per the
repo convention: focus an empty description on a project with history, accept with the keyboard,
accept with the mouse, type an accented Hungarian word without accents, change the project mid-type,
press Escape once (list closes) and twice (dialog closes), and confirm a brand-new assignment shows
the grouped cross-project fallback and nothing else.

## 13. Phasing

Three commits, each shippable alone.

| Slice | Contents                                                                                                    | Gate                        |
| ----- | ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| S1    | `description-suggestions.ts` + `text-search.ts` + payload field + `SuggestInput` + the quick composer wired | `pnpm verify:fast`, stories |
| S2    | Entry dialog (incl. the prefill-open behaviour), timer dialog, breakdown row for `needsDescription`         | `pnpm verify`, e2e          |
| S3    | MCP `recentDescriptions`, the zero-keystroke cross-project group, `docs/mcp-server.md` + QA plan lines      | `pnpm verify`, MCP tests    |

S1 alone is the feature for most of the value: the composer is where entries get made.

## 14. Alternatives considered, and why not

| Option                                                | Why not                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On-demand fetch (`/api/time/suggestions?projectId=…`) | A round-trip per keystroke-burst for ≤18 KB that the page can carry, plus a new authenticated route to keep member-scoped. Revisit only if §12.5 says the payload is too big.                                             |
| A materialized `description_suggestions` table        | A migration, a write path on every entry mutation, and a new way for the list to disagree with the entries after a delete or an admin edit. The derived read is correct by default.                                       |
| Postgres trigram index + server-side `ILIKE` search   | Real value at tens of thousands of rows per member. At a few hundred it is an index and an extension to maintain so the client can avoid a `String.includes`.                                                             |
| A favourites/pinned table now                         | It is a good feature (**Q2**, §18) and a different one: favourites are curated intent, suggestions are observed history. Shipping history first tells us whether curation is even wanted.                                 |
| Model-generated descriptions                          | The description ends up on an invoice line a human verifies. Inventing text there is the one place this app should not be clever. The MCP path in §10 deliberately pushes an agent toward the member's own words instead. |
| Inline ghost-text completion (Gmail-style)            | Tempting, and wrong here: it edits the field while you type, and a half-accepted description is a wrong invoice line. Reconsider only after the explicit list has been lived with.                                        |

## 15. Open decisions

1. **Half-life of 14 days** — the one tunable. Revisit after a month of use; a per-member setting is
   almost certainly over-engineering.
2. **The cross-project group** (§6.5) — ship it behind the "fewer than three" condition, and be
   ready to drop it. It is the only part of this that can put another project's words in front of
   you.
3. **Window: 90 or 180 days.** 90 matches `recentProjects` and Toggl. A monthly-timesheet app with
   quarterly work might want 180; decide with real data, not now.
4. **Tab semantics** (§6.1) — Tab currently closes without accepting. Google-style
   accept-on-Tab is faster and riskier; needs one real user's opinion, not a coin flip.
5. **Should the running timer's own description be a suggestion?** It is not an entry yet. Leaning
   no: it becomes one the moment the timer stops.

## 16. Effort

| Piece                                          | Estimate    |
| ---------------------------------------------- | ----------- |
| Server: suggestions module, payload, tests     | 0.5 day     |
| `SuggestInput` + `text-search` + stories/tests | 1–1.5 days  |
| Wiring three surfaces + breakdown row          | 0.5 day     |
| i18n, MCP, docs, QA plan, e2e                  | 0.5 day     |
| **Total**                                      | **~3 days** |

No migration, no dependency, no new top-level directory.

---

# Part B — The quality-of-life slate behind it

## 17. What has already shipped (so this slate is a fresh one)

`docs/time-tracking-ux-upgrades.md` was written before the `/time` redesign landed. Checked against
the code today, its backlog is mostly done: **A1** arrow-key grid navigation
(`WeeklyTimeGrid.tsx:298`), **A2** undoable delete with a six-second toast
(`TimeGridClient.tsx:618`), **A3/C2** Continue on an entry card (`EntryCard.tsx:142`), **A7** single-key
shortcuts plus a `?` sheet and a `⌘K` palette (`TimeCommandPalette.tsx`), **B3** capacity bars and
an over/on-target total, **B4** a distinct timer badge. Still open from that doc: **A5/C3** (a day
timeline), **A6** (spreadsheet paste), **B1** (drawer shell), **B2** (density), **C1** (forgotten
timer), **C4** (tags), **C5** (calendar import), **C6** (reminders — the notification
infrastructure now exists: `WEEKLY_HOURS_REMINDER` and `MONTHLY_INVOICE_REMINDER` are already
`NotificationType` values with a scheduler behind them).

So the slate below is the still-real items plus what the suggestion index makes newly cheap.

## 18. The slate

Ranked by value-per-effort for _this_ app — a monthly-timesheet app whose entries become invoice
lines — not by how impressive the feature sounds. **Q1–Q4 share Part A's index and cost far less
after it.**

**Q1. Natural-language quick add** · Effort M · Impact High
One field: `2h30 atlas code review` → project `Atlas Platform`, 2h30, description `code review`.
Parse in this order: duration via the existing `parseDurationToMinutes` (it already takes `2h30`,
`3.5`, `3:30`), then a project by accent-folded prefix match over the chips, then **the remainder
matched against Part A's suggestion index** so `code rev` resolves to the member's own
`Code review`. Everything ambiguous stays visible and editable — the composer's three fields update
as you type, they are not replaced.
_Why:_ the composer is already two clicks; this is one line and no clicks, and it is the only
addition that makes the `⌘K` palette able to log time from anywhere on the page rather than just
navigate. _Grounded in:_ `parseDurationToMinutes`, `TimeCommandPalette`, Part A's index.
_Inspired by:_ Toggl's and Timely's quick-add parsing, Linear's `⌘K`-create, Fantastical's date
parsing.

**Q2. Favourites — pinned entry templates** · Effort M · Impact High
Pin a `(project, description, optional duration)` and log it on the selected day in one click; the
pins sit above the suggestion list and in the timer dialog.
_Why:_ suggestions rank what you did; favourites are what you _always_ do — the standing meeting,
the weekly report. It is the single most-requested thing in Clockify's own forum around descriptions,
and it is the natural curated layer on top of Part A.
_Grounded in:_ needs a real table (`time_entry_favorite`: member, project, description, minutes,
sort order) — small, additive, no financial-chain contact. `TimeEntryDraft`'s
`(memberId, draftKey) → Json` store could hold pins with no migration for a trial, but that is a
deliberate hack and should not be the shipped shape. _Inspired by:_ Toggl Favorites, Clockify's
"favourite descriptions" requests.

**Q3. The usual duration, offered with the description** · Effort S · Impact Medium
When a suggestion is accepted into an empty duration field, show — never insert — `usually 1h 30m`
beside it, one click to apply. The same `groupBy` gives it away for free with an `_avg`, rounded to
5 minutes.
_Why:_ the pair (what, how long) is what repeats. _Caveat, and the reason it is display-only and
must stay so:_ in an app where hours become invoice lines, a number the app suggests is a number the
app is nudging. Offering is fine; prefilling is not. _Inspired by:_ Harvest's and Everhour's
recent-entry rows carrying their duration.

**Q4. Same-day duplicate guard** · Effort S · Impact Medium
On submit, if the same project **and** the same normalized description already exist on that day,
say so once — `Already logged 2h on Atlas · Code review today. Add anyway?` — with `Add anyway` and
`Open the existing entry`.
_Why:_ this app's most common data error is not a typo, it is a second copy of an entry after a
reload, a copy-yesterday, or an MCP call. The normalization from §3.3 makes the check exact and
free. _Grounded in:_ the same index; `copyEntriesByDateShift` already has a skip-existing concept
the wording can match. _Inspired by:_ Clockify's duplicate warning; the "skip existing" option this
app's own copy actions already offer.

**Q5. "Finish the week" gap detector** · Effort M · Impact High
A dismissible line above the week: `3 workdays with nothing logged: Tue, Wed, Fri` — each a link that
opens the composer on that day. Excludes future days, locked months, and weeks marked inactive for
every assigned project.
_Why:_ in a monthly-submission app the expensive failure is discovering a hole on submission day.
Everything needed is already computed — `buildWeekDays` knows the day states, `InactiveProjectWeek`
knows the deliberate blanks, and `MonthHeatNavigator` already _shows_ the empties without offering
to do anything about them. _Inspired by:_ Harvest's and Clockify's reminder digests; Timely's
"fill the blanks" framing.

**Q6. Submission preflight on `/timesheets`** · Effort M · Impact High
Before `Submit`, a read-only summary of what is odd about the month: workdays with nothing logged,
days over 24h or under target, entries with an empty description, overlapping intervals, declared
projects missing a proof document. Advisory only — none of it blocks submission.
_Why:_ every one of those signals already exists **per entry or per day** (`getEntryWarnings`,
`needsDescription`, `hasOverlaps`, the declaration proof state) and none is ever aggregated to the
month the member is about to freeze. A submitted revision is an immutable financial snapshot; the
cheapest possible improvement is a last look before it becomes one. _Grounded in:_ read-only
aggregation over existing helpers; no change to the revision itself, per the immutability rule.
_Inspired by:_ every expense tool's pre-submit review step; Harvest's timesheet approval checks.

**Q7. Forgotten-timer guard** · Effort M · Impact Medium/High
When a timer has run past a threshold (say 10h), the pill and the card say so, and stopping offers
`Keep 10h 12m` / `Trim to …` / `Discard`. On the next page load after a long absence, the same
prompt.
_Why:_ the only net today is the blunt 24h hard limit — and a 14-hour timer in this app is a
contractor invoice line, not a mislogged afternoon. It needs no background process: `startedAt` is
known and `shell-timer.ts` already renders the pill on every page. _Inspired by:_ Toggl's idle
detection, Memtime's after-the-fact categorization.

**Q8. Paste a week row from a spreadsheet** · Effort M · Impact Medium
Paste `8 8 8 4 0` (tab, comma or space separated) into a project's grid row and fill five day cells,
with locked and inactive days skipped and a single summary toast. Carried over from the old doc's
A6, still real, still cheap: `parseDurationToMinutes` already parses each token, and the grid now has
the keyboard model to make a row the unit of interaction.
_Why:_ contractors who keep a personal spreadsheet retype it cell by cell today.

### Parked, unchanged from the old doc

A day timeline (**A5/C3**), calendar-event import (**C5**), a tag layer (**C4**), per-project budgets
(**D1**), passive capture (**D2**). Each needs a product decision or an integration project, and
none of them is blocked by anything above.

### If you only do three

**Q1** (natural-language quick add) → **Q5** (gap detector) → **Q6** (submission preflight). One
makes logging faster, one makes the missing hours findable, one makes the irreversible step safer —
and none of them needs a schema change. **Q2** is the best candidate for the first feature that does.

## 19. Sources

Competitor behaviour above was checked against current documentation and user reports rather than
recalled:

- [Creating a Time Entry — Toggl Track Knowledge Base](https://support.toggl.com/en/articles/1957597-creating-a-time-entry)
- [Toggl Track: how to view entries older than 90 days](https://support.toggl.com/en/articles/5842701-how-to-view-entries-older-than-90-days)
  — the 90-day history horizon that §3.2's window matches
- [Toggl community: autocomplete only showing the current week's entries](https://community.toggl.com/t/bug-new-time-entry-autocomplete-only-showing-current-weeks-entries/2360)
  — the failure mode §3.2 avoids by anchoring to the visible week
- [Clockify CLI `description-autocomplete` / `description-autocomplete-days`](https://clockify-cli.netlify.app/en/commands/clockify-cli_config/)
  — prior art for a configurable lookback
- [Clockify forum: favourite and/or recent descriptions](https://forum.clockify.me/t/feature-request-favorite-and-or-recent-descriptions/3517) — Q2
- [Clockify forum: auto-suggest in the calendar view](https://forum.clockify.me/t/calendar-view-add-auto-suggest-similar-to-time-tracker-view/1464)
- [Zapier: the best time tracking apps in 2026](https://zapier.com/blog/best-time-tracking-apps/) —
  Timely's AI-drafted timesheets and Memtime's passive capture, the two patterns Part A deliberately
  does not copy (§14)
- [Tempo: worklog attributes and the Log Time form](https://help.tempo.io/kb/latest/time-tracker-worklogs-and-jira-automation)

---

# Part C — The build record

## 20. Where the build deviated from the plan

### 20.1 An over-long description is excluded, not truncated

§3.5 originally said a description longer than 160 characters would be carried "truncated with an
ellipsis". That is wrong, and the code excludes it instead: a suggestion is a thing you accept
_whole_, so an ellipsized one would have silently logged ellipsized text onto a report line and an
invoice. A 160-character description is also not the repeated boilerplate this feature exists to
recall. `buildDescriptionSuggestions` therefore drops the row, and a test pins the boundary
(exactly 160 is offered, 161 is not).

### 20.2 The `needsDescription` fix is in the dialog, not a new field in the breakdown

§6.6 planned an editable description in `BreakdownDialog`'s row. Built differently, deliberately:
that dialog has no form, no dirty state and no action wiring of its own, so an inline editable
field there would have been a second entry-editing surface to keep in step with the first for a
gesture the dialog already offers a route to. Instead the entry dialog focuses the description
whenever it opens on an empty one — the same rule as the grid-cell prefill moment — so `Edit` from
the breakdown lands with the list already open. Same number of interactions, one editing surface.

## 21. What was verified, and how

| Gate                                        | Result                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck` · `pnpm lint`              | clean (only the six warnings that predate this work)                                                                                                                                                    |
| `pnpm test`                                 | 980 passing, 4 skipped — including 27 new tests across `text-search`, `description-suggestions`, `SuggestInput` and the extended server test doubles                                                    |
| `pnpm test-storybook`                       | 507 passing, including nine new `SuggestInput` stories and three new product-block ones                                                                                                                 |
| `pnpm test:visual`                          | two **new** baselines (`suggest-input-*-darwin.png`); no existing baseline changed                                                                                                                      |
| Real browser (`playwright cli`, dev server) | the a11y tree reads `combobox [expanded]` → `listbox "Recent descriptions"` → named options with their meta line, a count-only live region, Enter accepting without submitting, and the two-step Escape |
| axe (WCAG 2.2 AA) with the list open        | 0 violations, run against the running app rather than a story                                                                                                                                           |
| `pnpm e2e`                                  | **not run** — `e2e/authenticated/time-suggestions.spec.ts` is written but unexecuted (§21.1)                                                                                                            |

### 21.1 Why the e2e spec is unrun

A `pnpm dev` server belonging to the developer was listening on `:3000` throughout, and Next refuses
a second dev server for the same directory. `pnpm e2e` would therefore have reused that server —
which is pinned to the **dev** database, not `sheet_happens_e2e` — and the suite writes (onboarding
flips member rows). Killing someone else's dev server to run a test suite is not a trade to make
silently. Run it with `:3000` free:

```
pnpm db:test          # once per clone
pnpm e2e e2e/authenticated/time-suggestions.spec.ts
```

The rest of the chain (`typecheck`, `lint`, `test`, `test-storybook`, `test:visual`) was run and is
recorded above.

## 22. Files

```txt
new   src/lib/text-search.ts · text-search.test.ts
new   src/server/time-tracking/description-suggestions.ts · .test.ts
new   src/components/ui/SuggestInput/{SuggestInput.tsx,.types.ts,.stories.tsx,.test.tsx,index.ts}
new   app/time/use-description-suggestions.ts
new   e2e/authenticated/time-suggestions.spec.ts
edit  src/server/time-tracking/{time-entries,context,index}.ts   payload field, MCP field, exports
edit  src/server/mcp/{schemas/common.ts,toolsets/time/get-context.ts,__contract__/tools-list.json}
edit  src/components/sheet/QuickEntryComposer/*  ·  src/components/sheet/TimerStartDialog/*
edit  app/time/{TimeGridClient,EntryModal,TimerCreateDialog}.tsx
edit  messages/{en,hu}.json                      seven keys under `TimeTracking.suggestions`
edit  visual/storybook.spec.ts                   two new baseline cases
edit  docs/manual-qa-test-plan.md · docs/mcp-server.md
```

The MCP contract baseline was regenerated deliberately with
`UPDATE_MCP_CONTRACT=1 pnpm test src/server/mcp/contract.test.ts`; its diff is one added paragraph
in the `time_get_context` description and one added output field, and no other tool moved.
