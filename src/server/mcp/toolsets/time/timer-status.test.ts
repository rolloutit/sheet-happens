import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { McpActor } from "../../actor";
import type { McpTool } from "../../tool";

/**
 * `timer_status` has one job — report the running timer, or that there is none — so the assertions
 * that matter are the mapping and the two channels agreeing. The `outputSchema.safeParse` check on
 * every result is the important one: the SDK validates `structuredContent` against that schema
 * before the result leaves the server, so a field the handler forgets or spells differently is
 * otherwise only visible as a runtime failure against a real client.
 */

const getRunningTimerForMember = vi.fn();

vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRunningTimerForMember: (...args: unknown[]) => getRunningTimerForMember(...args),
}));

const { timerStatusTool } = await import("./timer-status");

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
  annotations: Record<string, boolean>;
};

/** Captures what the tool hands the SDK, so the test drives the real registered handler. */
function register(tool: McpTool, forActor: McpActor) {
  let config: ToolConfig | undefined;
  let handler: (() => Promise<CallToolResult>) | undefined;

  const server = {
    registerTool: (
      _name: string,
      toolConfig: ToolConfig,
      toolHandler: () => Promise<CallToolResult>,
    ) => {
      config = toolConfig;
      handler = toolHandler;
    },
  };

  tool.register(server as never, forActor);

  if (!config || !handler) {
    throw new Error("The tool registered nothing.");
  }

  return { config, handler };
}

const NOW = new Date("2026-03-02T12:00:00.000Z");

describe("timer_status", () => {
  beforeEach(() => {
    getRunningTimerForMember.mockReset();
    // Fake time, because `elapsedMinutesFor` rounds up: with a real clock the milliseconds between
    // arranging the fixture and running the handler would push 90 minutes to 91.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers as a read-only tool that takes no arguments", () => {
    const { config } = register(timerStatusTool, actor);

    expect(timerStatusTool.name).toBe("timer_status");
    expect(timerStatusTool.scope).toBe("time:read");
    expect(config.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(config.inputSchema.safeParse({}).success).toBe(true);
    // `.strict()`: a guessed argument fails loudly instead of being ignored.
    expect(config.inputSchema.safeParse({ date: "2026-03-02" }).success).toBe(false);
  });

  it("reports the running timer with the minutes a stop would save", async () => {
    getRunningTimerForMember.mockResolvedValue({
      id: "timer-1",
      projectId: "project-1",
      projectAssignmentId: "assignment-1",
      projectName: "Acme Portal",
      projectColor: "#14b8a6",
      description: "Pairing on the invoice import",
      startedAt: "2026-03-02T10:30:00.000Z",
    });

    const { config, handler } = register(timerStatusTool, actor);
    const result = await handler();

    expect(getRunningTimerForMember).toHaveBeenCalledWith("member-1");
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      timer: {
        id: "timer-1",
        projectId: "project-1",
        projectName: "Acme Portal",
        description: "Pairing on the invoice import",
        startedAt: "2026-03-02T10:30:00.000Z",
        elapsedMinutes: 90,
      },
    });
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Running on Acme Portal since 2026-03-02T10:30:00.000Z — 1.5 so far.",
      },
    ]);
  });

  it("rounds a part-minute up, the way a stop would", async () => {
    getRunningTimerForMember.mockResolvedValue({
      id: "timer-1",
      projectId: "project-1",
      projectAssignmentId: "assignment-1",
      projectName: "Acme Portal",
      projectColor: "#14b8a6",
      description: "Triage",
      startedAt: "2026-03-02T11:58:30.000Z",
    });

    const { handler } = register(timerStatusTool, actor);
    const result = await handler();

    expect(result.structuredContent).toMatchObject({ timer: { elapsedMinutes: 2 } });
  });

  it("reports no timer as null rather than as an error", async () => {
    getRunningTimerForMember.mockResolvedValue(null);

    const { config, handler } = register(timerStatusTool, actor);
    const result = await handler();

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ timer: null });
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "No timer is running." }]);
  });
});
