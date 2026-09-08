import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TimeTrackingDateError, TimeTrackingError } from "@/src/server/time-tracking";

import { DOMAIN_MESSAGE_TO_MCP, mapDomainError, messageForCode } from "./errors";

const DOMAIN_DIR = path.join(process.cwd(), "src/server/time-tracking");

function readDomainSources() {
  return readdirSync(DOMAIN_DIR)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .map((file) => readFileSync(path.join(DOMAIN_DIR, file), "utf8"))
    .join("\n");
}

describe("mapDomainError", () => {
  it("maps a coded domain error to its wire code", () => {
    const mapped = mapDomainError(
      new TimeTrackingError("This period is locked by a submitted timesheet.", "PERIOD_LOCKED"),
    );

    expect(mapped.code).toBe("PERIOD_LOCKED");
    expect(mapped.correlationId).toBeUndefined();
  });

  /**
   * The domain splits "not active for this date" from "not assigned for this week" because its two
   * assignment lookups differ. An agent's only useful move is the same either way, so both collapse
   * — and a tool description can then name one code instead of two.
   */
  it("collapses the two project-availability codes into one", () => {
    expect(mapDomainError(new TimeTrackingError("x", "PROJECT_NOT_AVAILABLE")).code).toBe(
      "PROJECT_NOT_AVAILABLE",
    );
    expect(mapDomainError(new TimeTrackingError("x", "PROJECT_NOT_ASSIGNED_FOR_WEEK")).code).toBe(
      "PROJECT_NOT_AVAILABLE",
    );
  });

  it("maps a date error through its own code", () => {
    expect(
      mapDomainError(new TimeTrackingDateError("Choose a valid time.", "INVALID_TIME")).code,
    ).toBe("INVALID_TIME");
    expect(
      mapDomainError(
        new TimeTrackingDateError("End time must be after start time.", "END_BEFORE_START"),
      ).code,
    ).toBe("END_BEFORE_START");
  });

  /** A plain `Error` carrying a known sentence still lands on the right code. */
  it("falls back to the message table for an uncoded error", () => {
    const mapped = mapDomainError(new Error("Daily total cannot exceed 24 hours."));

    expect(mapped.code).toBe("DAILY_LIMIT_EXCEEDED");
  });

  /**
   * Anything unrecognised becomes a generic `INTERNAL` with a correlation id — never the raw
   * message, which could carry a stack, a SQL fragment or another member's data.
   */
  it("never leaks an unmapped message to the model", () => {
    const mapped = mapDomainError(
      new Error('relation "time_entries" does not exist for member 7f3a…'),
    );

    expect(mapped.code).toBe("INTERNAL");
    expect(mapped.message).not.toContain("time_entries");
    expect(mapped.message).toBe(messageForCode("INTERNAL"));
    expect(mapped.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("passes details through", () => {
    expect(
      mapDomainError(new TimeTrackingError("x", "ENTRY_NOT_FOUND"), { entryId: "e1" }).details,
    ).toEqual({ entryId: "e1" });
  });
});

/**
 * The guard the doc asks for.
 *
 * `DOMAIN_MESSAGE_TO_MCP` is the fallback used when an error reaches us without a code, so every
 * sentence in it has to still exist in the domain. If someone rewords one, this fails here rather
 * than degrading a tool result to `INTERNAL` in production — which is the kind of regression nothing
 * else would notice, because the tool still "works".
 */
describe("the domain message table", () => {
  const sources = readDomainSources();

  it("reads the domain source it is guarding", () => {
    // A wrong path would make every assertion below vacuously pass.
    expect(sources).toContain("export class TimeTrackingError");
    expect(sources.length).toBeGreaterThan(10_000);
  });

  it.each(Object.keys(DOMAIN_MESSAGE_TO_MCP))(
    "still finds %j thrown somewhere in src/server/time-tracking",
    (message) => {
      // The literal as it appears in source, with the quote style the repo uses.
      expect(sources).toContain(`"${message}"`);
    },
  );

  it("maps every code the domain can throw", () => {
    /*
     * Read the unions out of the source rather than importing them: they are types, so there is no
     * runtime value to iterate, and a hand-maintained list here would be the very thing that drifts.
     */
    const codes = new Set<string>();

    for (const match of sources.matchAll(/"([A-Z][A-Z0-9_]{2,})"/g)) {
      codes.add(match[1]!);
    }

    // Every code that actually appears as a second argument to one of the two error constructors.
    const thrown = new Set<string>();

    for (const match of sources.matchAll(
      /new TimeTracking(?:Date)?Error\(\s*(?:[^,()]|\([^)]*\))*,\s*"([A-Z][A-Z0-9_]+)"/g,
    )) {
      thrown.add(match[1]!);
    }

    expect(thrown.size).toBeGreaterThan(10);

    for (const code of thrown) {
      const mapped = mapDomainError(new TimeTrackingError("x", code as never));

      // An unmapped code would silently become INTERNAL, hiding an actionable failure from the
      // model. `TIMEZONE_FORMAT` is the one deliberate INTERNAL: a timezone the runtime cannot
      // format is our bug, not something an agent can do anything about.
      if (code === "TIMEZONE_FORMAT") {
        expect(mapped.code).toBe("INTERNAL");
        continue;
      }

      expect(mapped.code).not.toBe("INTERNAL");
    }

    expect(codes.has("PERIOD_LOCKED")).toBe(true);
  });
});
