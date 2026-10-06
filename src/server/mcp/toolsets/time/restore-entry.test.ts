import type { CallToolResult } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { TimeTrackingError } from "@/src/server/time-tracking";

import type { McpActor } from "../../actor";
import type { McpTool } from "../../tool";

const restoreTimeEntry = vi.fn();
const getMemberTimeEntry = vi.fn();
const listMemberTimeEntries = vi.fn();

/*
 * Only the reads and the write are stubbed; the original module is spread back in so the date
 * helpers `shared.ts` uses stay real and `TimeTrackingError` above is the very class `errors.ts`
 * checks with `instanceof` — a hand-rolled stand-in would map to INTERNAL and hide the mapping this
 * file is here to prove.
 */
vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  restoreTimeEntry: (...args: unknown[]) => restoreTimeEntry(...args),
  getMemberTimeEntry: (...args: unknown[]) => getMemberTimeEntry(...args),
  listMemberTimeEntries: (...args: unknown[]) => listMemberTimeEntries(...args),
}));

const { restoreEntryTool } = await import("./restore-entry");

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

type ToolConfig = {
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  annotations: Record<string, unknown>;
};

type ToolHandler = (args: { entryId: string }) => Promise<CallToolResult>;

/** Captures what the tool hands the SDK, so the config and the handler can be asserted separately. */
function register(tool: McpTool, forActor: McpActor) {
  let config: ToolConfig | undefined;
  let handler: ToolHandler | undefined;

  const server = {
    registerTool: (_name: string, toolConfig: ToolConfig, toolHandler: ToolHandler) => {
      config = toolConfig;
      handler = toolHandler;
    },
  };

  tool.register(server as never, forActor);

  if (!config || !handler) {
    throw new Error("The tool did not register itself.");
  }

  return { config, handler };
}

function textOf(result: CallToolResult) {
  const [block] = result.content;

  return block && block.type === "text" ? block.text : "";
}

const row = {
  id: "entry-1",
  date: "2026-03-02",
  projectId: "project-1",
  projectName: "Atlas",
  durationMinutes: 90,
  startTime: "09:00",
  endTime: "10:30",
  description: "Restored session",
  source: "MCP" as const,
  locked: false,
  updatedAt: "2026-03-02T10:31:00.000Z",
};

function dayPage(minutes: number) {
  return {
    range: { from: row.date, to: row.date },
    entries: [row],
    totals: { minutes, entryCount: 1 },
    nextCursor: null,
  };
}

describe("time_restore_entry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("declares itself as a non-destructive, idempotent write", () => {
    const { config } = register(restoreEntryTool, actor);

    expect(restoreEntryTool.scope).toBe("time:write");
    // Spelled out rather than compared against the shared constant: a restore that ever advertised
    // itself as destructive would collect a confirmation click it does not need, and a change to
    // that constant should fail here rather than pass by construction.
    expect(config.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("restores the entry and echoes it with its day", async () => {
    restoreTimeEntry.mockResolvedValue({ id: row.id });
    getMemberTimeEntry.mockResolvedValue(row);
    listMemberTimeEntries.mockResolvedValue(dayPage(90));

    const { config, handler } = register(restoreEntryTool, actor);
    const result = await handler({ entryId: row.id });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      entry: { id: row.id, date: row.date, durationMinutes: 90, locked: false },
      day: { date: row.date, totalMinutes: 90, overSoftLimit: false },
      warnings: [],
    });
    // The check that catches schema/handler drift, which is otherwise only visible at runtime.
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
    expect(textOf(result)).toContain("Restored:");
    expect(textOf(result)).toContain(row.description);

    // No `includeDeleted`: the echo reads the live row, which is what proves the restore took.
    expect(getMemberTimeEntry).toHaveBeenCalledWith({
      memberId: actor.member.id,
      timeEntryId: row.id,
    });
  });

  it("writes only ever for the actor's own member", async () => {
    restoreTimeEntry.mockResolvedValue({ id: row.id });
    getMemberTimeEntry.mockResolvedValue(row);
    listMemberTimeEntries.mockResolvedValue(dayPage(90));

    const { handler } = register(restoreEntryTool, actor);
    await handler({ entryId: row.id });

    expect(restoreTimeEntry).toHaveBeenCalledWith({
      memberId: actor.member.id,
      actorMemberId: actor.member.id,
      timeEntryId: row.id,
      requestMetadata: actor.requestMetadata,
    });

    const [input] = restoreTimeEntry.mock.calls[0] as [{ memberId: string; actorMemberId: string }];

    // Restated as its own assertion: the pair being equal is the structural guard against an agent
    // acting for anyone else, so it should fail loudly rather than as part of an object diff.
    expect(input.actorMemberId).toBe(input.memberId);
  });

  it("fails with ENTRY_NOT_FOUND when the restored entry cannot be read back", async () => {
    restoreTimeEntry.mockResolvedValue({ id: row.id });
    getMemberTimeEntry.mockResolvedValue(null);

    const { handler } = register(restoreEntryTool, actor);
    const result = await handler({ entryId: row.id });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "ENTRY_NOT_FOUND",
      details: { entryId: row.id },
    });
    // The day is never read when the entry is gone — a total for a row that no longer exists would
    // be a number the agent could quote back as if it meant something.
    expect(listMemberTimeEntries).not.toHaveBeenCalled();
  });

  it("surfaces a locked period as PERIOD_LOCKED instead of throwing", async () => {
    restoreTimeEntry.mockRejectedValue(
      new TimeTrackingError("This period is locked by a submitted timesheet.", "PERIOD_LOCKED"),
    );

    const { handler } = register(restoreEntryTool, actor);
    const result = await handler({ entryId: row.id });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "PERIOD_LOCKED" });
    expect(textOf(result)).toContain("PERIOD_LOCKED");
    expect(getMemberTimeEntry).not.toHaveBeenCalled();
  });

  it("rejects an unknown argument", () => {
    const { config } = register(restoreEntryTool, actor);

    expect(config.inputSchema.safeParse({ entryId: row.id }).success).toBe(true);
    // `.strict()` is what turns a guessed argument name into a corrected next turn.
    expect(config.inputSchema.safeParse({ entryId: row.id, timeEntryId: row.id }).success).toBe(
      false,
    );
  });
});
