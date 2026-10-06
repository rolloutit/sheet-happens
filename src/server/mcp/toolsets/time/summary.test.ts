import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { MemberTimeSummary } from "@/src/server/time-tracking";

import type { McpActor } from "../../actor";
import { READ_ONLY_ANNOTATIONS, type McpTool } from "../../tool";

const summarizeMemberTime = vi.fn();
const getMemberTrackingContext = vi.fn();

/*
 * Only the two reads are stubbed. Spreading the original keeps `parseDateOnly`, `getMonday`,
 * `getMonthEnd` and friends real, which is the point of these tests: the window arithmetic under
 * assertion here is the same code `/time` derives its own week from, not a copy of it.
 */
vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  summarizeMemberTime: (...args: unknown[]) => summarizeMemberTime(...args),
  getMemberTrackingContext: (...args: unknown[]) => getMemberTrackingContext(...args),
}));

const { summaryTool } = await import("./summary");

const actor = {
  member: {
    id: "member-1",
    displayName: "Ada",
    role: "MEMBER",
    currentProfile: "CONTRACTOR",
    timezone: "Europe/Budapest",
    locale: "en",
    durationDisplayFormat: "DECIMAL_HOURS",
    defaultTrackingMode: "TRACKED",
  },
  authUserId: "user-1",
  scopes: new Set(["time:read", "time:write"]),
  clientId: "https://claude.ai/x",
  tokenId: "jti-1",
  requestMetadata: {
    ipAddress: null,
    userAgent: null,
    channel: "MCP",
    clientId: "https://claude.ai/x",
  },
  token: "t",
} as unknown as McpActor;

type ToolRegistration = {
  config: {
    title: string;
    description: string;
    inputSchema: z.ZodType;
    outputSchema: z.ZodType;
    annotations: Record<string, boolean>;
  };
  handler: (args: unknown) => Promise<CallToolResult>;
};

/**
 * The three lines of `McpServer` this tool actually uses. Registering against a capture rather than
 * a real server keeps the assertions on what goes over the wire — the advertised schemas and
 * annotations included, which is the half a handler-only test cannot see.
 */
function register(tool: McpTool): ToolRegistration {
  const registrations: ToolRegistration[] = [];

  const server = {
    registerTool: (
      _name: string,
      config: ToolRegistration["config"],
      handler: ToolRegistration["handler"],
    ) => {
      registrations.push({ config, handler });
    },
  };

  tool.register(server as never, actor);

  const registration = registrations[0];

  if (!registration) {
    throw new Error("The tool registered nothing.");
  }

  return registration;
}

/** Runs the tool the way the SDK does: arguments parsed by the advertised schema, defaults applied. */
async function call(args: Record<string, unknown> = {}) {
  const { config, handler } = register(summaryTool);
  const result = await handler(config.inputSchema.parse(args));

  return { config, result };
}

function summaryFixture(overrides: Partial<MemberTimeSummary> = {}): MemberTimeSummary {
  return {
    period: { start: "2026-09-07", end: "2026-09-13", locked: false },
    totals: {
      trackedMinutes: 1860,
      declaredMinutes: 0,
      totalMinutes: 1860,
      entryCount: 14,
      daysWithEntries: 4,
      averageMinutesPerActiveDay: 465,
    },
    byProject: [
      { projectId: "project-1", name: "Alpha", minutes: 1200, entryCount: 9, share: 0.645 },
      { projectId: "project-2", name: "Beta", minutes: 660, entryCount: 5, share: 0.355 },
    ],
    byDay: [{ date: "2026-09-07", minutes: 510, entryCount: 4, overSoftLimit: true }],
    previous: { start: "2026-08-31", end: "2026-09-06", totalMinutes: 2100, deltaMinutes: -240 },
    ...overrides,
  };
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** The window the domain layer was actually asked for, as dates a human can read in a diff. */
function requestedWindow() {
  const [input] = summarizeMemberTime.mock.calls.at(-1) as [
    { memberId: string; from: Date; to: Date; compareWithPrevious?: boolean },
  ];

  return { ...input, from: iso(input.from), to: iso(input.to) };
}

function structuredOf(result: CallToolResult) {
  return result.structuredContent as {
    period: { kind: string; start: string; end: string; locked: boolean };
    totals: Record<string, number | string>;
    byProject: Array<{ minutes: number; minutesText: string }>;
    byDay: Array<{ date: string; minutesText: string }>;
    previous: { totalText: string; deltaMinutes: number; deltaText: string } | null;
    notes: string[];
  };
}

function textOf(result: CallToolResult) {
  const block = result.content?.[0];

  return block && block.type === "text" ? block.text : "";
}

describe("time_summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    summarizeMemberTime.mockResolvedValue(summaryFixture());
    getMemberTrackingContext.mockResolvedValue({ today: "2026-09-09" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers as a read-only tool with both schemas advertised", () => {
    const { config } = register(summaryTool);

    expect(summaryTool.name).toBe("time_summary");
    expect(summaryTool.scope).toBe("time:read");
    expect(config.annotations).toEqual(READ_ONLY_ANNOTATIONS);
    expect(config.inputSchema.parse({})).toEqual({ period: "week", compareWithPrevious: true });
  });

  it("summarizes one calendar day", async () => {
    await call({ period: "day", date: "2026-09-09" });

    expect(requestedWindow()).toMatchObject({
      memberId: "member-1",
      from: "2026-09-09",
      to: "2026-09-09",
      compareWithPrevious: true,
    });
  });

  it("summarizes the Monday-to-Sunday week the anchor falls in", async () => {
    await call({ period: "week", date: "2026-09-09" });

    expect(requestedWindow()).toMatchObject({ from: "2026-09-07", to: "2026-09-13" });
  });

  it("summarizes the whole calendar month the anchor falls in", async () => {
    await call({ period: "month", date: "2026-02-10" });

    expect(requestedWindow()).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("takes an explicit range as given", async () => {
    await call({ period: "range", from: "2026-08-03", to: "2026-08-16" });

    expect(requestedWindow()).toMatchObject({ from: "2026-08-03", to: "2026-08-16" });
    // A range carries its own window, so the orientation read is skipped entirely.
    expect(getMemberTrackingContext).not.toHaveBeenCalled();
  });

  it("anchors on today in the member's timezone rather than on the process clock", async () => {
    // 01:30 on Monday in Budapest, still Sunday evening in UTC. The UTC day would resolve to the
    // week that just ended; the member's day is the first of the new one.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T23:30:00Z"));
    getMemberTrackingContext.mockResolvedValue({ today: "2026-09-14" });

    await call({ period: "week" });

    expect(getMemberTrackingContext).toHaveBeenCalledWith({ memberId: "member-1" });
    expect(requestedWindow()).toMatchObject({ from: "2026-09-14", to: "2026-09-20" });
    expect(requestedWindow().from).not.toBe("2026-09-07");
  });

  it("refuses a range missing either end", async () => {
    const missingTo = await call({ period: "range", from: "2026-08-03" });
    const missingFrom = await call({ period: "range", to: "2026-08-16" });

    for (const { result } of [missingTo, missingFrom]) {
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ code: "VALIDATION" });
    }

    expect(summarizeMemberTime).not.toHaveBeenCalled();
  });

  it("refuses a backwards range instead of reporting an empty one", async () => {
    const { result } = await call({ period: "range", from: "2026-08-16", to: "2026-08-03" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "VALIDATION" });
    expect(summarizeMemberTime).not.toHaveBeenCalled();
  });

  it("refuses a range past the summary cap and allows the cap itself", async () => {
    const tooWide = await call({ period: "range", from: "2025-01-01", to: "2026-01-02" });

    expect(tooWide.result.isError).toBe(true);
    expect(tooWide.result.structuredContent).toMatchObject({
      code: "RANGE_TOO_LARGE",
      details: { requestedDays: 367, maxDays: 366 },
    });
    expect(summarizeMemberTime).not.toHaveBeenCalled();

    await call({ period: "range", from: "2025-01-01", to: "2026-01-01" });

    expect(requestedWindow()).toMatchObject({ from: "2025-01-01", to: "2026-01-01" });
  });

  it("keeps a drop signed in deltaMinutes and unsigned in deltaText", async () => {
    const { result } = await call({ period: "week", date: "2026-09-09" });
    const structured = structuredOf(result);

    expect(structured.previous).toMatchObject({
      deltaMinutes: -240,
      // Not "0": `formatDurationForInput` clamps a negative, which would report the four-hour
      // fall as no change at all.
      deltaText: "4",
      totalText: "35",
    });
    expect(textOf(result)).toContain("down 4");
  });

  it("reports declared hours in a second note, naming the figure", async () => {
    summarizeMemberTime.mockResolvedValue(
      summaryFixture({
        totals: {
          trackedMinutes: 1860,
          declaredMinutes: 600,
          totalMinutes: 2460,
          entryCount: 14,
          daysWithEntries: 4,
          averageMinutesPerActiveDay: 465,
        },
      }),
    );

    const { result } = await call({ period: "month", date: "2026-09-09" });
    const { notes } = structuredOf(result);

    expect(notes[0]).toBe(
      "Declared hours are reported separately and never mixed into tracked totals.",
    );
    expect(notes[1]).toContain("10 of declared hours");
    expect(structuredOf(result).totals).toMatchObject({
      declaredText: "10",
      trackedText: "31",
      totalText: "41",
    });
  });

  it("returns structuredContent the advertised outputSchema accepts", async () => {
    const { config, result } = await call({ period: "week", date: "2026-09-09" });

    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
    expect(structuredOf(result).period).toEqual({
      kind: "week",
      start: "2026-09-07",
      end: "2026-09-13",
      locked: false,
    });
    expect(structuredOf(result).byProject[0]).toMatchObject({ minutes: 1200, minutesText: "20" });
    expect(structuredOf(result).byDay[0]).toMatchObject({ minutesText: "8.5" });
  });

  it("drops the comparison — and still validates — when compareWithPrevious is false", async () => {
    summarizeMemberTime.mockResolvedValue(summaryFixture({ previous: null }));

    const { config, result } = await call({
      period: "week",
      date: "2026-09-09",
      compareWithPrevious: false,
    });

    expect(requestedWindow().compareWithPrevious).toBe(false);
    expect(structuredOf(result).previous).toBeNull();
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
  });
});
