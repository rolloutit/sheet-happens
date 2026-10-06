import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { McpActor } from "../../actor";
import type { McpTool } from "../../tool";

const updateTimeEntry = vi.fn();
const getMemberTimeEntry = vi.fn();
const listMemberTimeEntries = vi.fn();

/*
 * Only the reads and the write are stubbed. Spreading the original keeps `parseDateOnly` and the
 * rest of the date helpers real, so the `localDate` this tool forwards is the same `Date` the domain
 * would have built — a hand-rolled fake date helper would let a timezone bug pass here.
 */
vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  updateTimeEntry: (...args: unknown[]) => updateTimeEntry(...args),
  getMemberTimeEntry: (...args: unknown[]) => getMemberTimeEntry(...args),
  listMemberTimeEntries: (...args: unknown[]) => listMemberTimeEntries(...args),
}));

const { updateEntryTool } = await import("./update-entry");

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

type RegisteredConfig = {
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  annotations: Record<string, boolean>;
};

type RegisteredHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

/** Drives the tool without an MCP server: capture what it registers, then call it directly. */
function register(tool: McpTool) {
  const captured: { config?: RegisteredConfig; handler?: RegisteredHandler } = {};

  const server = {
    registerTool: (_name: string, config: RegisteredConfig, handler: RegisteredHandler) => {
      captured.config = config;
      captured.handler = handler;
    },
  };

  tool.register(server as unknown as McpServer, actor);

  if (!captured.config || !captured.handler) {
    throw new Error("The tool did not register itself.");
  }

  return { config: captured.config, handler: captured.handler };
}

const storedRow = {
  id: "entry-1",
  date: "2026-03-04",
  projectId: "project-1",
  projectName: "Atlas",
  durationMinutes: 90,
  startTime: null as string | null,
  endTime: null as string | null,
  description: "Reviewed the migration plan",
  source: "MCP" as const,
  locked: false,
  updatedAt: "2026-03-04T10:00:00.000Z",
};

/** Points both read stubs at one row, so the echo has a day to report as well as an entry. */
function stubEcho(overrides: Partial<typeof storedRow> = {}) {
  const row = { ...storedRow, ...overrides };

  getMemberTimeEntry.mockResolvedValue(row);
  listMemberTimeEntries.mockResolvedValue({
    range: { from: row.date, to: row.date },
    entries: [row],
    totals: { minutes: row.durationMinutes, entryCount: 1 },
    nextCursor: null,
  });

  return row;
}

function updateCall() {
  return updateTimeEntry.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateTimeEntry.mockResolvedValue({ id: "entry-1" });
  stubEcho();
});

describe("time_update_entry", () => {
  it("registers as a destructive but idempotent write", () => {
    const { config } = register(updateEntryTool);

    expect(updateEntryTool.scope).toBe("time:write");
    expect(config.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("sends no timingMode when only the description changes", async () => {
    const { handler } = register(updateEntryTool);

    await handler({ entryId: "entry-1", description: "Reviewed the migration plan again" });

    const call = updateCall();

    expect(call.description).toBe("Reviewed the migration plan again");
    // The four fields that would make the domain re-derive the entry's timing from scratch.
    expect(call).not.toHaveProperty("timingMode");
    expect(call).not.toHaveProperty("durationMinutes");
    expect(call).not.toHaveProperty("startTime");
    expect(call).not.toHaveProperty("endTime");
    // And nothing else the caller did not mention.
    expect(call).not.toHaveProperty("localDate");
    expect(call).not.toHaveProperty("projectId");
  });

  it("sends INTERVAL with both ends when given a start and an end", async () => {
    const { handler } = register(updateEntryTool);

    await handler({ entryId: "entry-1", startTime: "09:00", endTime: "11:30" });

    expect(updateCall()).toMatchObject({
      timingMode: "INTERVAL",
      startTime: "09:00",
      endTime: "11:30",
    });
    expect(updateCall()).not.toHaveProperty("durationMinutes");
  });

  it("sends DURATION when given minutes", async () => {
    const { handler } = register(updateEntryTool);

    await handler({ entryId: "entry-1", durationMinutes: 45 });

    expect(updateCall()).toMatchObject({ timingMode: "DURATION", durationMinutes: 45 });
    expect(updateCall()).not.toHaveProperty("startTime");
    expect(updateCall()).not.toHaveProperty("endTime");
  });

  it("forwards a moved date as a parsed day", async () => {
    const { handler } = register(updateEntryTool);

    await handler({ entryId: "entry-1", date: "2026-03-05" });

    const localDate = updateCall().localDate;

    expect(localDate).toBeInstanceOf(Date);
    expect((localDate as Date).toISOString()).toBe("2026-03-05T00:00:00.000Z");
  });

  it("writes for the actor's own member on both ids", async () => {
    const { handler } = register(updateEntryTool);

    await handler({ entryId: "entry-1", durationMinutes: 45 });

    expect(updateCall()).toMatchObject({
      memberId: "member-1",
      actorMemberId: "member-1",
      timeEntryId: "entry-1",
      requestMetadata: actor.requestMetadata,
    });
  });

  it("rejects a patch that changes nothing", () => {
    const { config } = register(updateEntryTool);

    const parsed = config.inputSchema.safeParse({ entryId: "entry-1" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("at least one field");
  });

  it("rejects a duration mixed with an interval", () => {
    const { config } = register(updateEntryTool);

    const parsed = config.inputSchema.safeParse({
      entryId: "entry-1",
      durationMinutes: 45,
      startTime: "09:00",
      endTime: "09:45",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("not both");
  });

  it("accepts one half of an interval so the domain can name the rule", () => {
    const { config } = register(updateEntryTool);

    // START_END_REQUIRED is a better answer than a refine message written without knowing how the
    // stored entry is timed, so the schema deliberately lets this through.
    expect(config.inputSchema.safeParse({ entryId: "entry-1", startTime: "09:00" }).success).toBe(
      true,
    );
  });

  it("echoes the entry and its day, and matches its own outputSchema", async () => {
    const row = stubEcho({ durationMinutes: 150, startTime: "09:00", endTime: "11:30" });
    const { config, handler } = register(updateEntryTool);

    const result = await handler({ entryId: "entry-1", startTime: "09:00", endTime: "11:30" });

    expect(getMemberTimeEntry).toHaveBeenCalledWith({
      memberId: "member-1",
      timeEntryId: "entry-1",
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      entry: { id: row.id, date: row.date, durationMinutes: 150, durationText: "2.5" },
      day: { date: row.date, totalMinutes: 150, totalText: "2.5", overSoftLimit: false },
      warnings: [],
    });
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Updated: 2026-03-04 09:00-11:30"),
    });
  });

  it("reports ENTRY_NOT_FOUND when the row cannot be read back", async () => {
    getMemberTimeEntry.mockResolvedValue(null);
    const { handler } = register(updateEntryTool);

    const result = await handler({ entryId: "entry-1", durationMinutes: 45 });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "ENTRY_NOT_FOUND",
      details: { entryId: "entry-1" },
    });
  });

  it("maps a domain throw onto its wire code", async () => {
    const { TimeTrackingError } = await import("@/src/server/time-tracking");
    updateTimeEntry.mockRejectedValue(
      new TimeTrackingError("This entry is locked by a submitted timesheet.", "ENTRY_LOCKED"),
    );
    const { handler } = register(updateEntryTool);

    const result = await handler({ entryId: "entry-1", durationMinutes: 45 });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "ENTRY_LOCKED" });
  });
});
