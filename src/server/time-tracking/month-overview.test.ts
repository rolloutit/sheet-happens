import { describe, expect, it } from "vitest";

import {
  buildMonthOverview,
  type MonthOverviewAssignment,
  type MonthOverviewDeclarationRow,
} from "./month-overview";

const MONTH_START = "2026-09-01";
const MONTH_END = "2026-09-30";

function assignment(
  projectId: string,
  overrides: Partial<MonthOverviewAssignment> = {},
): MonthOverviewAssignment {
  return {
    assignmentId: `assignment-${projectId}`,
    projectId,
    name: projectId,
    color: "#37e3de",
    trackingMode: null,
    member: { defaultTrackingMode: "TRACKED" },
    active: true,
    validFrom: "2026-01-01",
    validTo: null,
    projectStartsOn: null,
    projectEndsOn: null,
    projectRetired: false,
    ...overrides,
  };
}

function declaration(
  projectId: string,
  minutes: number,
  overrides: Partial<MonthOverviewDeclarationRow> = {},
): MonthOverviewDeclarationRow {
  return {
    projectId,
    assignmentId: `assignment-${projectId}`,
    name: projectId,
    color: "#f2b8ff",
    minutes,
    note: "Platform migration support",
    ...overrides,
  };
}

function build(input: {
  assignments?: MonthOverviewAssignment[];
  minutes?: Record<string, number>;
  declarations?: MonthOverviewDeclarationRow[];
}) {
  return buildMonthOverview({
    monthStart: MONTH_START,
    monthEnd: MONTH_END,
    assignments: input.assignments ?? [],
    trackedMinutesByProjectId: new Map(Object.entries(input.minutes ?? {})),
    declarations: input.declarations ?? [],
  });
}

describe("buildMonthOverview", () => {
  it("puts each project in the band its resolved mode names", () => {
    const month = build({
      assignments: [
        assignment("Atlas Platform"),
        assignment("Nimbus", { trackingMode: "DECLARED" }),
      ],
      minutes: { "Atlas Platform": 5_640 },
      declarations: [declaration("Nimbus", 3_120)],
    });

    expect(month.tracked.map((project) => project.projectId)).toEqual(["Atlas Platform"]);
    expect(month.declared.map((project) => project.projectId)).toEqual(["Nimbus"]);
  });

  it("inherits the member default when the assignment names no mode", () => {
    const month = build({
      assignments: [
        assignment("Nimbus", { member: { defaultTrackingMode: "DECLARED" } }),
        assignment("Atlas Platform", {
          member: { defaultTrackingMode: "DECLARED" },
          trackingMode: "TRACKED",
        }),
      ],
      minutes: { "Atlas Platform": 480 },
    });

    // The declared-by-default assignment gets no tracked row, the override does.
    expect(month.tracked.map((project) => project.projectId)).toEqual(["Atlas Platform"]);
  });

  /** §8's own month: 94 h tracked plus 22 h tracked plus 52 h declared is the 168 h in the header. */
  it("counts both kinds of hours in the month total", () => {
    const month = build({
      assignments: [
        assignment("Atlas Platform"),
        assignment("Internal Ops"),
        assignment("Nimbus", { trackingMode: "DECLARED" }),
      ],
      minutes: { "Atlas Platform": 5_640, "Internal Ops": 1_320 },
      declarations: [declaration("Nimbus", 3_120)],
    });

    expect(month.trackedMinutes).toBe(6_960);
    expect(month.declaredMinutes).toBe(3_120);
    expect(month.totalMinutes).toBe(10_080);
  });

  it("gives a live project with no hours a row, so a forgotten month is visible", () => {
    const month = build({ assignments: [assignment("Orion Rollout")] });

    expect(month.tracked).toEqual([
      expect.objectContaining({ projectId: "Orion Rollout", minutes: 0 }),
    ]);
  });

  it("leaves out a project that is no longer live and logged nothing in the month", () => {
    const month = build({
      assignments: [
        assignment("Finished", { validTo: "2026-08-31" }),
        assignment("Deactivated", { active: false }),
        assignment("Archived", { projectRetired: true }),
        assignment("Not started", { projectStartsOn: "2026-10-01" }),
        assignment("Ended", { projectEndsOn: "2026-08-15" }),
      ],
    });

    expect(month.tracked).toEqual([]);
  });

  it("keeps a project that logged hours even after it stopped being live", () => {
    const month = build({
      assignments: [assignment("Archived", { active: false, projectRetired: true })],
      minutes: { Archived: 900 },
    });

    expect(month.tracked).toEqual([
      expect.objectContaining({ projectId: "Archived", minutes: 900 }),
    ]);
  });

  it("collapses two assignment periods for one project into one row", () => {
    const month = build({
      assignments: [
        assignment("Atlas Platform", {
          assignmentId: "early",
          validFrom: "2026-01-01",
          validTo: "2026-09-14",
        }),
        assignment("Atlas Platform", { assignmentId: "late", validFrom: "2026-09-15" }),
      ],
      minutes: { "Atlas Platform": 2_400 },
    });

    // One row, and the later period is the one a write on a day in this month would resolve to.
    expect(month.tracked).toHaveLength(1);
    expect(month.tracked[0]).toMatchObject({ assignmentId: "late", minutes: 2_400 });
  });

  it("counts hours the query returned even when no row can be produced for them", () => {
    // An assignment window narrowed after the fact leaves entries outside it. The month total is a
    // figure someone closes against, so it reports the database rather than what happened to render.
    const month = build({ minutes: { Orphaned: 600 } });

    expect(month.tracked).toEqual([]);
    expect(month.trackedMinutes).toBe(600);
    expect(month.totalMinutes).toBe(600);
  });

  it("orders both bands by project name", () => {
    const month = build({
      assignments: [
        assignment("Zephyr"),
        assignment("Atlas Platform"),
        assignment("Nimbus", { trackingMode: "DECLARED" }),
        assignment("Borealis", { trackingMode: "DECLARED" }),
      ],
      declarations: [declaration("Nimbus", 60), declaration("Borealis", 120)],
    });

    expect(month.tracked.map((project) => project.name)).toEqual(["Atlas Platform", "Zephyr"]);
    expect(month.declared.map((project) => project.name)).toEqual(["Borealis", "Nimbus"]);
  });

  it("carries the month it was built for", () => {
    const month = build({});

    expect(month).toMatchObject({ monthStart: MONTH_START, monthEnd: MONTH_END });
  });
});
