import type { CallToolResult } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { McpActor } from "../../actor";
import type { McpTool } from "../../tool";

/**
 * The one tool that writes new time, so the assertions are about the three things that would let it
 * write the wrong thing: which timing mode it picks from the arguments, that it can only ever write
 * for its own member, and that it tags the row as `MCP` so the grid, reports and the audit trail can
 * tell an agent's entry from a click.
 */

const createTimeEntry = vi.fn();
const getMemberTimeEntry = vi.fn();
const listMemberTimeEntries = vi.fn();

vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createTimeEntry: (...args: unknown[]) => createTimeEntry(...args),
  getMemberTimeEntry: (...args: unknown[]) => getMemberTimeEntry(...args),
  listMemberTimeEntries: (...args: unknown[]) => listMemberTimeEntries(...args),
}));

const { createEntryTool } = await import("./create-entry");

type ToolConfig = {
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  annotations: Record<string, boolean>;
};

function register(tool: McpTool, forActor: McpActor) {
  let config: ToolConfig | undefined;
  let handler: ((args: never) => Promise<CallToolResult>) | undefined;

  const server = {
    registerTool: (
      _name: string,
      toolConfig: ToolConfig,
      toolHandler: (args: never) => Promise<CallToolResult>,
    ) => {
      config = toolConfig;
      handler = toolHandler;
    },
  };

  tool.register(server as never, forActor);

  if (!config || !handler) throw new Error("the tool registered nothing");

  return { config, handler };
}

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
    ipAddress: "203.0.113.7",
    userAgent: "claude",
    channel: "MCP",
    clientId: "https://claude.ai/x",
  },
  token: "t",
} as unknown as McpActor;

function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    date: "2026-09-07",
    projectId: "project-1",
    projectName: "Atlas Platform",
    durationMinutes: 120,
    startTime: null,
    endTime: null,
    description: "Refactoring the importer",
    source: "MCP",
    locked: false,
    updatedAt: "2026-09-07T10:00:00.000Z",
    ...overrides,
  };
}

/** The echo path: `readMutationResult` reads the row, then the day it landed in. */
function stubEcho(row = entryRow(), dayMinutes = 120) {
  getMemberTimeEntry.mockResolvedValue(row);
  listMemberTimeEntries.mockResolvedValue({
    range: { from: row.date, to: row.date },
    entries: [row],
    totals: { minutes: dayMinutes, entryCount: 1 },
    nextCursor: null,
  });
}

/**
 * The text channel, narrowed. `CallToolResult["content"]` is a union that also allows image and
 * audio blocks, so reading `.text` off an element does not typecheck without asserting the variant.
 */
function textOf(result: CallToolResult) {
  const first = result.content[0];

  return first && first.type === "text" ? first.text : "";
}

beforeEach(() => {
  createTimeEntry.mockReset();
  getMemberTimeEntry.mockReset();
  listMemberTimeEntries.mockReset();
  createTimeEntry.mockResolvedValue({ id: "entry-1" });
});

describe("time_create_entry", () => {
  it("registers as a non-destructive write tool", () => {
    const { config } = register(createEntryTool, actor);

    expect(createEntryTool.name).toBe("time_create_entry");
    expect(createEntryTool.scope).toBe("time:write");
    expect(config.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
  });

  describe("the timing arguments", () => {
    const base = { date: "2026-09-07", projectId: "project-1", description: "Refactoring" };

    it("accepts a duration on its own", () => {
      const { config } = register(createEntryTool, actor);

      expect(config.inputSchema.safeParse({ ...base, durationMinutes: 120 }).success).toBe(true);
    });

    it("accepts a start and end pair", () => {
      const { config } = register(createEntryTool, actor);

      expect(
        config.inputSchema.safeParse({ ...base, startTime: "09:00", endTime: "11:00" }).success,
      ).toBe(true);
    });

    /**
     * Both is ambiguous and neither is incomplete. Refusing at the schema means the model is told
     * which mistake it made, instead of the server silently preferring one and writing a duration
     * the member never asked for.
     */
    it("refuses both a duration and an interval", () => {
      const { config } = register(createEntryTool, actor);

      expect(
        config.inputSchema.safeParse({
          ...base,
          durationMinutes: 120,
          startTime: "09:00",
          endTime: "11:00",
        }).success,
      ).toBe(false);
    });

    it("refuses neither, and a half-given interval", () => {
      const { config } = register(createEntryTool, actor);

      expect(config.inputSchema.safeParse(base).success).toBe(false);
      expect(config.inputSchema.safeParse({ ...base, startTime: "09:00" }).success).toBe(false);
    });

    it("refuses a stray argument rather than ignoring it", () => {
      const { config } = register(createEntryTool, actor);

      expect(
        config.inputSchema.safeParse({ ...base, durationMinutes: 120, memberId: "member-2" })
          .success,
      ).toBe(false);
    });

    it("refuses a duration past the daily cap and a malformed date", () => {
      const { config } = register(createEntryTool, actor);

      expect(config.inputSchema.safeParse({ ...base, durationMinutes: 1441 }).success).toBe(false);
      expect(config.inputSchema.safeParse({ ...base, durationMinutes: 0 }).success).toBe(false);
      expect(
        config.inputSchema.safeParse({ ...base, date: "07/09/2026", durationMinutes: 60 }).success,
      ).toBe(false);
    });
  });

  it("writes a duration entry as MCP, for its own member only", async () => {
    stubEcho();

    const { config, handler } = register(createEntryTool, actor);
    const result = await handler({
      date: "2026-09-07",
      projectId: "project-1",
      description: "Refactoring the importer",
      durationMinutes: 120,
    } as never);

    const call = createTimeEntry.mock.calls[0]?.[0] as Record<string, unknown>;

    // Both ids the actor's own: the domain reads a mismatch as an admin correction, so passing the
    // same id twice is the structural guarantee an agent cannot write against anyone else.
    expect(call.memberId).toBe("member-1");
    expect(call.actorMemberId).toBe("member-1");
    expect(call.source).toBe("MCP");
    expect(call.timingMode).toBe("DURATION");
    expect(call.durationMinutes).toBe(120);
    expect(call.requestMetadata).toMatchObject({ channel: "MCP", clientId: "https://claude.ai/x" });

    expect(result.isError).toBeUndefined();
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  it("writes an interval entry in interval mode", async () => {
    stubEcho(entryRow({ startTime: "09:00", endTime: "11:00" }));

    const { handler } = register(createEntryTool, actor);
    await handler({
      date: "2026-09-07",
      projectId: "project-1",
      description: "Pairing",
      startTime: "09:00",
      endTime: "11:00",
    } as never);

    const call = createTimeEntry.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(call.timingMode).toBe("INTERVAL");
    expect(call.startTime).toBe("09:00");
    expect(call.endTime).toBe("11:00");
    expect(call.durationMinutes).toBeUndefined();
  });

  it("echoes the entry and the day's new total in the member's own format", async () => {
    stubEcho(entryRow(), 150);

    const { handler } = register(createEntryTool, actor);
    const result = await handler({
      date: "2026-09-07",
      projectId: "project-1",
      description: "Refactoring the importer",
      durationMinutes: 120,
    } as never);

    const structured = result.structuredContent as {
      entry: Record<string, unknown>;
      day: Record<string, unknown>;
      warnings: string[];
    };

    expect(structured.entry.id).toBe("entry-1");
    // DECIMAL_HOURS: 120 minutes reads as "2", and the day's 150 as "2.5".
    expect(structured.entry.durationText).toBe("2");
    expect(structured.day).toEqual({
      date: "2026-09-07",
      totalMinutes: 150,
      totalText: "2.5",
      overSoftLimit: false,
    });
    expect(structured.warnings).toEqual([]);
    expect(textOf(result)).toContain("Logged:");
  });

  /** The 8-hour line the grid draws and the server never blocks on — a fact, not a refusal. */
  it("warns about a day over the soft limit without failing", async () => {
    stubEcho(entryRow({ durationMinutes: 60 }), 9 * 60);

    const { handler } = register(createEntryTool, actor);
    const result = await handler({
      date: "2026-09-07",
      projectId: "project-1",
      description: "Long day",
      durationMinutes: 60,
    } as never);

    const structured = result.structuredContent as {
      day: { overSoftLimit: boolean };
      warnings: string[];
    };

    expect(result.isError).toBeUndefined();
    expect(structured.day.overSoftLimit).toBe(true);
    expect(structured.warnings.join(" ")).toContain("soft target");
  });

  it("maps a locked period onto its wire code", async () => {
    const { TimeTrackingError } = await import("@/src/server/time-tracking");

    createTimeEntry.mockRejectedValue(
      new TimeTrackingError("This period is locked by a submitted timesheet.", "PERIOD_LOCKED"),
    );

    const { handler } = register(createEntryTool, actor);
    const result = await handler({
      date: "2026-07-14",
      projectId: "project-1",
      description: "Late entry",
      durationMinutes: 60,
    } as never);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe("PERIOD_LOCKED");
    expect(getMemberTimeEntry).not.toHaveBeenCalled();
  });

  it("maps a declared project onto its wire code", async () => {
    const { TimeTrackingError } = await import("@/src/server/time-tracking");

    createTimeEntry.mockRejectedValue(
      new TimeTrackingError("This project declares its hours monthly.", "PROJECT_DECLARES_MONTHLY"),
    );

    const { handler } = register(createEntryTool, actor);
    const result = await handler({
      date: "2026-09-07",
      projectId: "project-declared",
      description: "Nope",
      durationMinutes: 60,
    } as never);

    expect((result.structuredContent as { code: string }).code).toBe("PROJECT_DECLARES_MONTHLY");
  });

  /**
   * The write landed and the read back did not. Reporting plain success would leave the agent unable
   * to reference or correct the row it just made, so this is deliberately an error with the id in it.
   */
  it("reports an unreadable echo rather than claiming plain success", async () => {
    getMemberTimeEntry.mockResolvedValue(null);
    listMemberTimeEntries.mockResolvedValue({
      range: { from: "2026-09-07", to: "2026-09-07" },
      entries: [],
      totals: { minutes: 0, entryCount: 0 },
      nextCursor: null,
    });

    const { handler } = register(createEntryTool, actor);
    const result = await handler({
      date: "2026-09-07",
      projectId: "project-1",
      description: "Refactoring",
      durationMinutes: 60,
    } as never);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "INTERNAL",
      details: { entryId: "entry-1" },
    });
  });
});
