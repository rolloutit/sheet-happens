import { prisma } from "@/src/server/db/client";

import { addDays, formatDateOnly, normalizeDateOnly } from "./dates";

/**
 * What this member has been calling their work lately, per project.
 *
 * `/time` already preloads every other kind of memory the page has — the assigned projects, the
 * recent projects behind the composer's chips, both month overviews, a half-typed draft — while the
 * description, the one field that reaches a report line verbatim, had none. This is that memory: a
 * derived read over the member's own entries, ranked, capped, and shipped inside the week payload
 * so a composer that opens forty times a week costs no round-trips.
 *
 * Derived rather than materialized on purpose (§14 of `docs/time-entry-suggestions.md`). There is
 * no counter column and no cache table to drift, so a delete, an undo, an edit or an admin
 * correction is reflected the moment the page revalidates — which every mutating action on `/time`
 * already does.
 *
 * Member-scoped by construction, exactly as `queries.ts` states for `listMemberTimeEntries`:
 * `memberId` is required, it is the first clause of the `where`, and there is no parameter that
 * widens it. Another member's phrasing must not be reachable from here by any argument.
 */

/** How far back a suggestion may come from. Matches the `recentProjects` window in `time-entries.ts`. */
export const SUGGESTION_LOOKBACK_DAYS = 90;

/**
 * The half-life of a suggestion's usefulness, in days.
 *
 * A description used thirty times over two months is what this member logs; one used once yesterday
 * is not. Plain recency ranks the second above the first, plain frequency keeps last quarter's
 * project at the top all quarter, and this blends them (§3.4). A sprint is the unit that felt right;
 * it is the one number in the feature worth tuning against real use.
 */
export const SUGGESTION_HALF_LIFE_DAYS = 14;

/** Kept per project in the page payload. The panel shows at most six at a time. */
export const SUGGESTIONS_PER_PROJECT = 12;

/** A hard stop for the whole payload, so a member on twenty projects cannot inflate the page. */
export const SUGGESTIONS_PER_PAYLOAD = 96;

/**
 * Descriptions longer than this are not suggested at all.
 *
 * Not truncated — *excluded*. A suggestion is a thing you accept whole, so offering an ellipsized
 * one would silently log the ellipsized text onto an invoice line. A 160-character description is
 * also not the repeated boilerplate this feature exists to recall.
 */
export const SUGGESTION_TEXT_MAX_LENGTH = 160;

/** What an agent gets per project from `time_get_context` — a prompt, not a panel. */
export const MCP_SUGGESTIONS_PER_PROJECT = 5;

export type DescriptionSuggestion = {
  /** Exactly as it was last typed, trimmed. Never re-cased, never re-worded. */
  text: string;
  projectId: string;
  /** Entries in the window that used this text on this project, merged across casings. */
  useCount: number;
  /** `YYYY-MM-DD` of the most recent one, for the meta line and for the ranking. */
  lastUsedOn: string;
};

/** One `groupBy` row: a project, a description, how often, and how recently. */
export type DescriptionSuggestionRow = {
  projectId: string;
  description: string;
  _count: { _all: number };
  _max: { localDate: Date | null };
};

/**
 * Only the one read this module makes.
 *
 * Narrow rather than `typeof prisma` for the reasons `TimeEntryQueryClient` gives: a test can hand
 * over a plain object, and a second query cannot be added here without widening this type, which
 * shows up in review.
 */
export type DescriptionSuggestionClient = {
  timeEntry: {
    groupBy: (args: unknown) => Promise<DescriptionSuggestionRow[]>;
  };
};

export type BuildDescriptionSuggestionsInput = {
  /**
   * The day the window ends on — the **visible** week's end, not today.
   *
   * Recency is measured against it rather than against the clock, so the same week always ranks the
   * same way and no test needs a fake timer.
   */
  anchor: Date;
  /** Only these projects get suggestions: a project with no chip has nowhere to use one. */
  projectIds: readonly string[];
  perProject?: number;
  perPayload?: number;
};

/**
 * Read the rows the ranking needs.
 *
 * Deliberately **not** filtered by project id. In `getMemberWeeklyTimeGrid` this runs inside the
 * same `Promise.all` as the assignment loader, so the project ids are not known yet — the same
 * position the `recentProjects` read is in, and it is resolved the same way: read bounded by member
 * and window, then intersect on the way out. Adding the filter would serialize a parallel read to
 * save a filter step over a few hundred rows.
 *
 * No `orderBy` and no `take` either: ranking and capping happen in `buildDescriptionSuggestions`,
 * which is what makes them testable with a plain array and no database.
 */
export async function loadDescriptionSuggestionRows(
  input: { memberId: string; windowEnd: Date; lookbackDays?: number },
  deps: { db?: DescriptionSuggestionClient } = {},
): Promise<DescriptionSuggestionRow[]> {
  const db = deps.db ?? (prisma as unknown as DescriptionSuggestionClient);
  const windowEnd = normalizeDateOnly(input.windowEnd);
  const windowStart = addDays(windowEnd, -(input.lookbackDays ?? SUGGESTION_LOOKBACK_DAYS));

  return db.timeEntry.groupBy({
    by: ["projectId", "description"],
    where: {
      memberId: input.memberId,
      deletedAt: null,
      /* The same exclusion, for the same reason, as the `recentProjects` read: a declared month is
         one 52-hour row on the 1st whose text is a declaration note, and offering it in a composer
         that cannot write to that project at all is a contradiction the member sees before we do. */
      source: {
        not: "DECLARED",
      },
      description: {
        not: "",
      },
      localDate: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    _count: { _all: true },
    _max: { localDate: true },
  });
}

/**
 * Rank, merge and cap the rows into the list the client renders.
 *
 * Pure, and the only place the scoring lives — the page and the MCP context call it with different
 * caps, never with different rules, which is what keeps an agent and the grid from suggesting
 * different things to the same person on the same day.
 */
export function buildDescriptionSuggestions(
  rows: readonly DescriptionSuggestionRow[],
  input: BuildDescriptionSuggestionsInput,
): DescriptionSuggestion[] {
  const anchor = normalizeDateOnly(input.anchor);
  const projectIds = new Set(input.projectIds);
  const perProject = input.perProject ?? SUGGESTIONS_PER_PROJECT;
  const perPayload = input.perPayload ?? SUGGESTIONS_PER_PAYLOAD;
  const merged = new Map<string, DescriptionSuggestion>();

  for (const row of rows) {
    if (!projectIds.has(row.projectId)) continue;
    if (!row._max.localDate) continue;

    const text = row.description.trim().replace(/\s+/g, " ");

    if (!text || text.length > SUGGESTION_TEXT_MAX_LENGTH) continue;

    const lastUsedOn = formatDateOnly(normalizeDateOnly(row._max.localDate));
    const key = `${row.projectId} ${dedupeKey(text)}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        text,
        projectId: row.projectId,
        useCount: row._count._all,
        lastUsedOn,
      });
      continue;
    }

    existing.useCount += row._count._all;

    // The casing shown is the most recent one, so a member who deliberately re-worded last week
    // reads last week's wording back.
    if (lastUsedOn > existing.lastUsedOn) {
      existing.text = text;
      existing.lastUsedOn = lastUsedOn;
    }
  }

  const ranked = [...merged.values()].sort((left, right) =>
    compareSuggestions(left, right, anchor),
  );
  const perProjectCount = new Map<string, number>();
  const capped: DescriptionSuggestion[] = [];

  for (const suggestion of ranked) {
    if (capped.length >= perPayload) break;

    const used = perProjectCount.get(suggestion.projectId) ?? 0;

    if (used >= perProject) continue;

    perProjectCount.set(suggestion.projectId, used + 1);
    capped.push(suggestion);
  }

  return capped;
}

/**
 * `useCount` decayed by how long ago it was last used.
 *
 * Exported for the test that pins the ordering, and because a score nobody can inspect is a score
 * nobody can tune.
 */
export function scoreSuggestion(
  suggestion: Pick<DescriptionSuggestion, "useCount" | "lastUsedOn">,
  anchor: Date,
  halfLifeDays = SUGGESTION_HALF_LIFE_DAYS,
) {
  const days = daysBefore(suggestion.lastUsedOn, anchor);

  return suggestion.useCount * 0.5 ** (days / halfLifeDays);
}

/**
 * A **total** order, so the list cannot wobble between two renders of the same data — the same
 * property `queries.ts` needs from its cursor, for a less important but more visible reason.
 */
function compareSuggestions(
  left: DescriptionSuggestion,
  right: DescriptionSuggestion,
  anchor: Date,
) {
  const byScore = scoreSuggestion(right, anchor) - scoreSuggestion(left, anchor);

  if (byScore !== 0) return byScore;
  if (left.lastUsedOn !== right.lastUsedOn) return left.lastUsedOn < right.lastUsedOn ? 1 : -1;
  if (left.useCount !== right.useCount) return right.useCount - left.useCount;
  if (left.text !== right.text) return left.text < right.text ? -1 : 1;
  if (left.projectId === right.projectId) return 0;

  return left.projectId < right.projectId ? -1 : 1;
}

/** Whole days between a `YYYY-MM-DD` and the anchor, never negative. */
function daysBefore(isoDate: string, anchor: Date) {
  const used = new Date(`${isoDate}T00:00:00.000Z`).getTime();
  const days = Math.floor((anchor.getTime() - used) / 86_400_000);

  return days > 0 ? days : 0;
}

/**
 * `Sprint planning`, `sprint planning` and `Sprint  planning` are one suggestion.
 *
 * Hungarian rather than the host locale for the case fold: this app's other locale is Hungarian, a
 * locale-less `toLowerCase` folds a Turkish dotted capital differently on a differently configured
 * host, and the key never reaches a screen so nothing is lost by pinning it.
 */
function dedupeKey(text: string) {
  return text.toLocaleLowerCase("hu");
}
