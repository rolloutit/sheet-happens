import type { CallToolResult } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { McpActor } from "../../actor";
import type { McpTool } from "../../tool";

const stopRunningTimer = vi.fn();
const getMemberTimeEntry = vi.fn();
const listMemberTimeEntries = vi.fn();

/*
 * Only the reads and the write are stubbed; the original module is spread back in so `parseDateOnly`
 * (used by `readDay`) and `TimeTrackingError` stay the real ones — the error mapping is keyed on that
 * class identity, so a hand-rolled stand-in would silently degrade every domain throw to INTERNAL.
 */
vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  stopRunningTimer: (...args: unknown[]) => stopRunningTimer(...args),
  getMemberTimeEntry: (...args: unknown[]) => getMemberTimeEntry(...args),
  listMemberTimeEntries: (...args: unknown[]) => listMemberTimeEntries(...args),
}));

const { TimeTrackingError } = await import("@/src/server/time-tracking");
const { timerStopTool } = await import("./timer-stop");

type RegisteredConfig = {
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  annotations: Record<string, unknown>;
};

type RegisteredHandler = () => Promise<CallToolResult>;

function register(tool: McpTool, forActor: McpActor) {
  let config: RegisteredConfig | undefined;
  let handler: RegisteredHandler | undefined;

  const server = {
    registerTool: (_name: string, toolConfig: RegisteredConfig, toolHandler: RegisteredHandler) => {
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

const savedRow = {
  id: "entry-9",
  date: "2026-03-04",
  projectId: "project-1",
  projectName: "Atlas",
  durationMinutes: 92,
  startTime: "09:00",
  endTime: "10:32",
  description: "Tracked with timer",
  source: "TIMER",
  locked: false,
  updatedAt: "2026-03-04T09:32:11.000Z",
};

const dayPage = {
  range: { from: "2026-03-04", to: "2026-03-04" },
  entries: [savedRow],
  totals: { minutes: 92, entryCount: 1 },
  nextCursor: null,
};

/** The error contract, as `fail` shapes it. */
function errorOf(result: CallToolResult) {
  return result.structuredContent as { code: string; message: string; details?: unknown };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("timerStopTool", () => {
  it("registers as a write tool that takes no arguments", () => {
    const { config } = register(timerStopTool, actor);

    expect(timerStopTool.name).toBe("timer_stop");
    expect(timerStopTool.scope).toBe("time:write");
    expect(config.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
    expect(config.inputSchema.safeParse({}).success).toBe(true);
    // A model that invents an argument has to be told so, not quietly obeyed with it dropped.
    expect(config.inputSchema.safeParse({ entryId: "entry-9" }).success).toBe(false);
  });

  it("echoes the saved entry and its day, and only ever acts for its own member", async () => {
    stopRunningTimer.mockResolvedValue({ id: "entry-9", saved: true });
    getMemberTimeEntry.mockResolvedValue(savedRow);
    listMemberTimeEntries.mockResolvedValue(dayPage);

    const { config, handler } = register(timerStopTool, actor);
    const result = await handler();

    expect(result.isError).toBeUndefined();
    // The drift check: a handler field the schema does not declare is only visible here.
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
    expect(result.structuredContent).toEqual({
      entry: {
        id: "entry-9",
        date: "2026-03-04",
        projectId: "project-1",
        projectName: "Atlas",
        durationMinutes: 92,
        durationText: "1.53",
        startTime: "09:00",
        endTime: "10:32",
        description: "Tracked with timer",
        source: "TIMER",
        locked: false,
        updatedAt: "2026-03-04T09:32:11.000Z",
      },
      day: { date: "2026-03-04", totalMinutes: 92, totalText: "1.53", overSoftLimit: false },
      warnings: [],
    });

    expect(stopRunningTimer).toHaveBeenCalledWith({
      memberId: "member-1",
      actorMemberId: "member-1",
      requestMetadata: actor.requestMetadata,
    });
  });

  it("reports the daily-limit discard as a failure with no entry", async () => {
    stopRunningTimer.mockResolvedValue({ discarded: true, reason: "DAILY_LIMIT" });

    const { handler } = register(timerStopTool, actor);
    const result = await handler();

    expect(result.isError).toBe(true);

    const error = errorOf(result);

    expect(error.code).toBe("TIMER_DISCARDED_DAILY_LIMIT");
    // The wording is load-bearing: an agent that reads this must not narrate a save.
    expect(error.message).toMatch(/stopped without saving/i);
    expect(error.message).toMatch(/not recorded/i);
    expect(error.details).toEqual({ reason: "DAILY_LIMIT" });
    expect(result.structuredContent).not.toHaveProperty("entry");
    // Nothing was written, so nothing is read back.
    expect(getMemberTimeEntry).not.toHaveBeenCalled();
  });

  it("maps the domain throw for a missing timer to NO_TIMER_RUNNING", async () => {
    stopRunningTimer.mockRejectedValue(
      new TimeTrackingError("No timer is running.", "NO_TIMER_RUNNING"),
    );

    const { handler } = register(timerStopTool, actor);
    const result = await handler();

    expect(result.isError).toBe(true);
    expect(errorOf(result).code).toBe("NO_TIMER_RUNNING");
    expect(errorOf(result).message).toBe("No timer is running.");
  });

  it("does not claim success when the saved entry cannot be read back", async () => {
    stopRunningTimer.mockResolvedValue({ id: "entry-9", saved: true });
    getMemberTimeEntry.mockResolvedValue(null);

    const { handler } = register(timerStopTool, actor);
    const result = await handler();

    expect(result.isError).toBe(true);
    expect(errorOf(result).code).toBe("INTERNAL");
    expect(errorOf(result).details).toEqual({ entryId: "entry-9" });
  });
});
