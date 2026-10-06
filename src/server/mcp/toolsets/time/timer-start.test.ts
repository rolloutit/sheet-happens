import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { TimeTrackingError } from "@/src/server/time-tracking";

import type { McpActor } from "../../actor";
import { WRITE_ANNOTATIONS, type McpTool } from "../../tool";

const startRunningTimer = vi.fn();
const getRunningTimerForMember = vi.fn();

/*
 * Only the two calls this tool makes are stubbed; everything else — `TimeTrackingError` above
 * included — stays the real module, so `instanceof` in the tool matches the error thrown here.
 */
vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  startRunningTimer: (...args: unknown[]) => startRunningTimer(...args),
  getRunningTimerForMember: (...args: unknown[]) => getRunningTimerForMember(...args),
}));

const { timerStartTool } = await import("./timer-start");

const NOW = new Date("2026-09-07T10:00:00.000Z");
const STARTED_AT = "2026-09-07T09:30:00.000Z";

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
  annotations: Record<string, unknown>;
};

type RegisteredHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

/** Captures what the tool hands the SDK, so the handler can be driven without a transport. */
function register(tool: McpTool, forActor: McpActor) {
  let config: RegisteredConfig | undefined;
  let handler: RegisteredHandler | undefined;

  const server = {
    registerTool: (_name: string, registeredConfig: RegisteredConfig, fn: RegisteredHandler) => {
      config = registeredConfig;
      handler = fn;
    },
  };

  tool.register(server as never, forActor);

  if (!config || !handler) {
    throw new Error("timer_start did not register itself.");
  }

  return { config, handler };
}

function runningTimer(overrides: Record<string, unknown> = {}) {
  return {
    id: "timer-1",
    projectId: "project-1",
    projectAssignmentId: "assignment-1",
    projectName: "Acme Rebuild",
    projectColor: "#123456",
    description: "Tracked with timer",
    startedAt: STARTED_AT,
    ...overrides,
  };
}

describe("timer_start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Elapsed minutes are asserted literally, so the clock cannot be the real one.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("declares the write annotations explicitly", () => {
    const { config } = register(timerStartTool, actor);

    expect(config.annotations).toEqual(WRITE_ANNOTATIONS);
    expect(timerStartTool.scope).toBe("time:write");
  });

  it("defaults the description to the literal a stopped blank timer gets", async () => {
    startRunningTimer.mockResolvedValue({ id: "timer-1" });
    getRunningTimerForMember.mockResolvedValue(runningTimer());

    const { config, handler } = register(timerStartTool, actor);
    const result = await handler({ projectId: "project-1" });

    expect(startRunningTimer).toHaveBeenCalledWith(
      expect.objectContaining({
        // Both ids are the actor's own: the domain layer reads a mismatch as an admin correction.
        memberId: "member-1",
        actorMemberId: "member-1",
        projectId: "project-1",
        description: "Tracked with timer",
        requestMetadata: actor.requestMetadata,
      }),
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      timer: {
        id: "timer-1",
        projectId: "project-1",
        projectName: "Acme Rebuild",
        description: "Tracked with timer",
        startedAt: STARTED_AT,
        elapsedMinutes: 30,
      },
    });
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  it("passes a given description through unchanged", async () => {
    startRunningTimer.mockResolvedValue({ id: "timer-1" });
    getRunningTimerForMember.mockResolvedValue(runningTimer({ description: "Pairing on auth" }));

    const { config, handler } = register(timerStartTool, actor);
    const result = await handler({ projectId: "project-1", description: "Pairing on auth" });

    expect(startRunningTimer).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Pairing on auth" }),
    );
    expect(result.structuredContent).toMatchObject({
      timer: { description: "Pairing on auth" },
    });
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  it("reports the already-running timer in details instead of re-throwing", async () => {
    startRunningTimer.mockRejectedValue(
      new TimeTrackingError(
        "Stop the running timer before starting another one.",
        "TIMER_ALREADY_RUNNING",
      ),
    );
    getRunningTimerForMember.mockResolvedValue(
      runningTimer({ id: "timer-9", description: "Standup" }),
    );

    const { handler } = register(timerStartTool, actor);
    const result = await handler({ projectId: "project-2" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "TIMER_ALREADY_RUNNING",
      details: {
        timer: {
          id: "timer-9",
          projectId: "project-1",
          projectName: "Acme Rebuild",
          description: "Standup",
          startedAt: STARTED_AT,
          elapsedMinutes: 30,
        },
      },
    });
    expect(getRunningTimerForMember).toHaveBeenCalledWith("member-1");
  });

  it("lets every other domain failure reach runTool's mapping", async () => {
    startRunningTimer.mockRejectedValue(
      new TimeTrackingError("This project declares its hours monthly.", "PROJECT_DECLARES_MONTHLY"),
    );

    const { handler } = register(timerStartTool, actor);
    const result = await handler({ projectId: "project-3" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "PROJECT_DECLARES_MONTHLY" });
    // The enrichment read is reserved for the already-running case.
    expect(getRunningTimerForMember).not.toHaveBeenCalled();
  });

  it("fails loudly when the started timer cannot be read back", async () => {
    startRunningTimer.mockResolvedValue({ id: "timer-1" });
    getRunningTimerForMember.mockResolvedValue(null);

    const { handler } = register(timerStartTool, actor);
    const result = await handler({ projectId: "project-1" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "INTERNAL" });
  });
});
