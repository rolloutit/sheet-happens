import { describe, expect, it, vi } from "vitest";

import {
  buildDescriptionSuggestions,
  loadDescriptionSuggestionRows,
  scoreSuggestion,
  SUGGESTION_TEXT_MAX_LENGTH,
  SUGGESTIONS_PER_PROJECT,
  type DescriptionSuggestionClient,
  type DescriptionSuggestionRow,
} from "./description-suggestions";

const ATLAS = "11111111-1111-4111-8111-111111111111";
const OPS = "22222222-2222-4222-8222-222222222222";
const GONE = "33333333-3333-4333-8333-333333333333";

/** The anchor every test ranks against: a week end, never a clock. */
const ANCHOR = new Date("2026-09-06T00:00:00.000Z");

function row(
  projectId: string,
  description: string,
  count: number,
  lastUsedOn: string,
): DescriptionSuggestionRow {
  return {
    projectId,
    description,
    _count: { _all: count },
    _max: { localDate: new Date(`${lastUsedOn}T00:00:00.000Z`) },
  };
}

describe("buildDescriptionSuggestions", () => {
  it("keeps only the projects it was asked about", () => {
    const suggestions = buildDescriptionSuggestions(
      [row(ATLAS, "Sprint planning", 3, "2026-09-04"), row(GONE, "Old work", 9, "2026-09-05")],
      { anchor: ANCHOR, projectIds: [ATLAS, OPS] },
    );

    expect(suggestions.map((suggestion) => suggestion.text)).toEqual(["Sprint planning"]);
  });

  it("merges casing and whitespace variants, keeping the most recent wording", () => {
    const suggestions = buildDescriptionSuggestions(
      [
        row(ATLAS, "sprint planning", 4, "2026-08-20"),
        row(ATLAS, "Sprint  planning", 1, "2026-09-04"),
        row(ATLAS, "  Sprint planning  ", 2, "2026-08-28"),
      ],
      { anchor: ANCHOR, projectIds: [ATLAS] },
    );

    expect(suggestions).toEqual([
      {
        text: "Sprint planning",
        projectId: ATLAS,
        useCount: 7,
        lastUsedOn: "2026-09-04",
      },
    ]);
  });

  it("scopes the merge to one project, so two projects keep their own counts", () => {
    const suggestions = buildDescriptionSuggestions(
      [row(ATLAS, "Code review", 5, "2026-09-01"), row(OPS, "Code review", 2, "2026-09-01")],
      { anchor: ANCHOR, projectIds: [ATLAS, OPS] },
    );

    expect(suggestions).toEqual([
      { text: "Code review", projectId: ATLAS, useCount: 5, lastUsedOn: "2026-09-01" },
      { text: "Code review", projectId: OPS, useCount: 2, lastUsedOn: "2026-09-01" },
    ]);
  });

  it("ranks the current habit first, above both a one-off and a stale habit", () => {
    const suggestions = buildDescriptionSuggestions(
      [
        // Used once, yesterday: recent, but not what this member does.
        row(ATLAS, "Fixed the flaky test", 1, "2026-09-05"),
        // Used constantly, still current.
        row(ATLAS, "API endpoint implementation", 18, "2026-09-03"),
        // Used constantly, but two months ago — last quarter's work.
        row(ATLAS, "Database migration work", 22, "2026-07-06"),
      ],
      { anchor: ANCHOR, projectIds: [ATLAS] },
    );

    expect(suggestions[0].text).toBe("API endpoint implementation");
    /* The other two are within 10% of each other by design — 22 uses decayed over two months
       against one use yesterday — so their relative order is not something to pin. What matters is
       that neither approaches the habit that is still going. */
    expect(scoreSuggestion(suggestions[0], ANCHOR)).toBeGreaterThan(
      10 * scoreSuggestion(suggestions[1], ANCHOR),
    );
  });

  it("ranks recency ahead of frequency once the frequencies are comparable", () => {
    const suggestions = buildDescriptionSuggestions(
      [row(ATLAS, "Code review", 3, "2026-08-09"), row(ATLAS, "Bug triage", 3, "2026-09-04")],
      { anchor: ANCHOR, projectIds: [ATLAS] },
    );

    expect(suggestions.map((suggestion) => suggestion.text)).toEqual(["Bug triage", "Code review"]);
  });

  it("orders identically however the rows arrive", () => {
    const rows = [
      row(ATLAS, "Sprint planning", 3, "2026-09-02"),
      row(ATLAS, "Code review", 3, "2026-09-02"),
      row(ATLAS, "Bug triage", 3, "2026-09-02"),
      row(OPS, "CI pipeline maintenance", 3, "2026-09-02"),
    ];
    const forwards = buildDescriptionSuggestions(rows, {
      anchor: ANCHOR,
      projectIds: [ATLAS, OPS],
    });
    const backwards = buildDescriptionSuggestions([...rows].reverse(), {
      anchor: ANCHOR,
      projectIds: [ATLAS, OPS],
    });

    // Every field is equal on these rows except the text, so only the total order can settle them.
    expect(backwards).toEqual(forwards);
    expect(forwards.map((suggestion) => suggestion.text)).toEqual([
      "Bug triage",
      "CI pipeline maintenance",
      "Code review",
      "Sprint planning",
    ]);
  });

  it("excludes an over-long description rather than truncating it", () => {
    const long = "x".repeat(SUGGESTION_TEXT_MAX_LENGTH + 1);
    const atLimit = "y".repeat(SUGGESTION_TEXT_MAX_LENGTH);
    const suggestions = buildDescriptionSuggestions(
      [row(ATLAS, long, 40, "2026-09-05"), row(ATLAS, atLimit, 1, "2026-09-05")],
      { anchor: ANCHOR, projectIds: [ATLAS] },
    );

    expect(suggestions.map((suggestion) => suggestion.text)).toEqual([atLimit]);
  });

  it("drops a row the database could not date", () => {
    const suggestions = buildDescriptionSuggestions(
      [
        {
          projectId: ATLAS,
          description: "Sprint planning",
          _count: { _all: 2 },
          _max: { localDate: null },
        },
      ],
      { anchor: ANCHOR, projectIds: [ATLAS] },
    );

    expect(suggestions).toEqual([]);
  });

  it("caps per project and then per payload", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, index) =>
        row(ATLAS, `Atlas task ${index}`, 8 - index, "2026-09-04"),
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        row(OPS, `Ops task ${index}`, 8 - index, "2026-09-04"),
      ),
    ];
    const suggestions = buildDescriptionSuggestions(rows, {
      anchor: ANCHOR,
      projectIds: [ATLAS, OPS],
      perProject: 3,
      perPayload: 5,
    });

    expect(suggestions).toHaveLength(5);
    expect(suggestions.filter((suggestion) => suggestion.projectId === ATLAS)).toHaveLength(3);
    // The payload cap bites after the per-project one, so Ops keeps its best two.
    expect(
      suggestions.filter((suggestion) => suggestion.projectId === OPS).map((s) => s.text),
    ).toEqual(["Ops task 0", "Ops task 1"]);
  });

  it("measures recency against the anchor, not against today", () => {
    const rows = [row(ATLAS, "Sprint planning", 1, "2025-03-03")];
    const atThatWeek = buildDescriptionSuggestions(rows, {
      anchor: new Date("2025-03-09T00:00:00.000Z"),
      projectIds: [ATLAS],
    });

    // Ranking a frozen week 18 months later must give the same list it gave that week.
    expect(atThatWeek).toEqual(
      buildDescriptionSuggestions(rows, { anchor: ANCHOR, projectIds: [ATLAS] }),
    );
  });
});

describe("payload budget", () => {
  /**
   * The caps are the whole reason this can ride in the page payload, so the size they produce is
   * asserted rather than argued about. Ninety days of a busy member: twelve projects, a hundred and
   * fifty distinct descriptions each, at the maximum length a suggestion may have.
   */
  it("stays small under the caps, however much history there is", () => {
    const projectIds = Array.from({ length: 12 }, (_, index) => `project-${index}`);
    const rows = projectIds.flatMap((projectId) =>
      Array.from({ length: 150 }, (_, index) =>
        row(
          projectId,
          `${projectId} description ${index} `.padEnd(SUGGESTION_TEXT_MAX_LENGTH, "x"),
          150 - index,
          "2026-09-04",
        ),
      ),
    );

    const suggestions = buildDescriptionSuggestions(rows, { anchor: ANCHOR, projectIds });
    const bytes = new TextEncoder().encode(JSON.stringify(suggestions)).length;

    expect(suggestions).toHaveLength(96);

    /* The payload cap takes the 96 best-scoring rows, which — when scores are comparable across
       projects, as they are here — spreads them over every project rather than filling up on the
       first few. What is guaranteed is the per-project ceiling. */
    const perProject = new Map<string, number>();

    for (const suggestion of suggestions) {
      perProject.set(suggestion.projectId, (perProject.get(suggestion.projectId) ?? 0) + 1);
    }

    expect(Math.max(...perProject.values())).toBeLessThanOrEqual(SUGGESTIONS_PER_PROJECT);
    // Worst case, uncompressed. A real member's descriptions are a fraction of the length cap.
    expect(bytes).toBeLessThan(32_000);
  });
});

describe("scoreSuggestion", () => {
  it("halves a suggestion's weight every half-life", () => {
    const fresh = scoreSuggestion({ useCount: 8, lastUsedOn: "2026-09-06" }, ANCHOR);
    const oneHalfLife = scoreSuggestion({ useCount: 8, lastUsedOn: "2026-08-23" }, ANCHOR);

    expect(fresh).toBe(8);
    expect(oneHalfLife).toBeCloseTo(4, 5);
  });

  it("does not reward a date past the anchor", () => {
    expect(scoreSuggestion({ useCount: 2, lastUsedOn: "2026-09-30" }, ANCHOR)).toBe(2);
  });
});

describe("loadDescriptionSuggestionRows", () => {
  it("reads one member's own dated, described, non-declared entries in the window", async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const db = { timeEntry: { groupBy } } as unknown as DescriptionSuggestionClient;

    await loadDescriptionSuggestionRows(
      { memberId: "member-1", windowEnd: new Date("2026-09-06T00:00:00.000Z") },
      { db },
    );

    expect(groupBy).toHaveBeenCalledWith({
      by: ["projectId", "description"],
      where: {
        memberId: "member-1",
        deletedAt: null,
        source: { not: "DECLARED" },
        description: { not: "" },
        localDate: {
          gte: new Date("2026-06-08T00:00:00.000Z"),
          lte: new Date("2026-09-06T00:00:00.000Z"),
        },
      },
      _count: { _all: true },
      _max: { localDate: true },
    });
  });

  it("takes no project filter, because the assignments are still loading beside it", async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const db = { timeEntry: { groupBy } } as unknown as DescriptionSuggestionClient;

    await loadDescriptionSuggestionRows(
      { memberId: "member-1", windowEnd: new Date("2026-09-06T00:00:00.000Z") },
      { db },
    );

    const [args] = groupBy.mock.calls[0] as [{ where: Record<string, unknown> }];

    expect(args.where).not.toHaveProperty("projectId");
  });
});
