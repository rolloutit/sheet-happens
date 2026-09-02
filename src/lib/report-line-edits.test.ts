import { describe, expect, it } from "vitest";

import {
  createCostFreeReportSnapshot,
  createInternalReportSnapshot,
} from "@/src/server/reports/report-snapshot.fixture";

import { applyReportLineEdits, parseReportLineEdits } from "./report-line-edits";

describe("parseReportLineEdits", () => {
  it("accepts valid description and duration overlays", () => {
    expect(
      parseReportLineEdits(
        JSON.stringify([{ id: "entry-1", description: "Edited", durationMinutes: 90 }]),
      ),
    ).toEqual([{ id: "entry-1", description: "Edited", durationMinutes: 90 }]);
  });

  it("drops malformed and out-of-range overlays", () => {
    expect(
      parseReportLineEdits(
        JSON.stringify([
          { id: "entry-1", durationMinutes: 1_441 },
          { id: "entry-2", durationMinutes: 60.5 },
          { description: "Missing id" },
        ]),
      ),
    ).toEqual([]);
  });
});

describe("applyReportLineEdits", () => {
  it("updates only matching report lines and recalculates cost-free totals", () => {
    const snapshot = createCostFreeReportSnapshot();
    const target = snapshot.lines[0]!;
    const result = applyReportLineEdits(snapshot, [
      { id: target.id, description: "Edited work", durationMinutes: 30 },
      { id: "not-in-the-report", durationMinutes: 1_000 },
    ]);

    expect(result.lines[0]).toMatchObject({ description: "Edited work", durationMinutes: 30 });
    expect(result.summary.totalMinutes).toBe(
      snapshot.summary.totalMinutes - target.durationMinutes + 30,
    );
  });

  it("recalculates internal amounts when hours change", () => {
    const snapshot = createInternalReportSnapshot();
    const target = snapshot.lines.find((line) => line.rate)!;
    const result = applyReportLineEdits(snapshot, [{ id: target.id, durationMinutes: 60 }]);

    expect(result.mode).toBe("INTERNAL");
    if (result.mode !== "INTERNAL") throw new Error("Expected an internal report.");

    expect(result.lines.find((line) => line.id === target.id)?.amount).toBe(
      target.rate!.hourlyRate,
    );
  });
});
