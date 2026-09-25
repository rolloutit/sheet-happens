import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { McpActor } from "../../actor";
import type { McpTool } from "../../tool";

/**
 * `time_get_context` is the tool every other call depends on, so the assertions here are about the
 * three things a wrong answer would silently corrupt: the date it reports as "today" (an agent that
 * gets the server's day logs to the wrong one), which projects it says are writable, and the scopes
 * it claims to hold.
 */

const getMemberTrackingContext = vi.fn();

vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getMemberTrackingContext: (...args: unknown[]) => getMemberTrackingContext(...args),
}));

const { getContextTool } = await import("./get-context");

type ToolConfig = {
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  annotations: Record<string, boolean>;
};

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

  if (!config || !handler) throw new Error("the tool registered nothing");

  return { config, handler };
}

function makeActor(overrides: Partial<McpActor> = {}) {
  return {
    member: {
      id: "member-1",
      displayName: "Ada Lovelace",
      role: "MEMBER",
      currentProfile: "CONTRACTOR",
      timezone: "Pacific/Kiritimati",
      locale: "en",
      durationDisplayFormat: "HOURS_MINUTES",
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
    ...overrides,
  } as unknown as McpActor;
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    member: {
      id: "member-1",
      displayName: "Ada Lovelace",
      timezone: "Pacific/Kiritimati",
      locale: "en",
      durationDisplayFormat: "HOURS_MINUTES",
      profile: "CONTRACTOR",
      defaultTrackingMode: "TRACKED",
    },
    today: "2026-09-08",
    week: { start: "2026-09-07", end: "2026-09-13" },
    month: { start: "2026-09-01", end: "2026-09-30" },
    projects: [
      {
        assignmentId: "assignment-1",
        projectId: "project-tracked",
        name: "Atlas Platform",
        color: "#0f766e",
        isInternal: false,
        validFrom: "2026-01-01",
        validTo: null,
        projectStartsOn: null,
        projectEndsOn: null,
        trackingMode: "TRACKED",
        canLogTime: true,
        recentDescriptions: ["API endpoint implementation", "Sprint planning"],
      },
      {
        assignmentId: "assignment-2",
        projectId: "project-declared",
        name: "Retainer",
        color: "#b45309",
        isInternal: false,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        projectStartsOn: null,
        projectEndsOn: null,
        trackingMode: "DECLARED",
        canLogTime: false,
        recentDescriptions: [],
      },
    ],
    lockedMonths: ["2026-07", "2026-06"],
    runningTimer: null,
    ...overrides,
  };
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
  getMemberTrackingContext.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("time_get_context", () => {
  it("registers as a read-only tool that takes no arguments", () => {
    const { config } = register(getContextTool, makeActor());

    expect(getContextTool.name).toBe("time_get_context");
    expect(getContextTool.scope).toBe("time:read");
    expect(config.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    // An extra argument fails rather than being ignored: a model guessing at an API it does not have
    // learns the real one on the next turn instead of getting a different answer than it asked for.
    expect(config.inputSchema.safeParse({ date: "2026-09-08" }).success).toBe(false);
    expect(config.inputSchema.safeParse({}).success).toBe(true);
  });

  it("reports the member, their windows, their projects and the granted scopes", async () => {
    getMemberTrackingContext.mockResolvedValue(context());

    const { config, handler } = register(getContextTool, makeActor());
    const result = await handler();

    expect(getMemberTrackingContext).toHaveBeenCalledWith({ memberId: "member-1" });
    expect(result.isError).toBeUndefined();

    const structured = result.structuredContent as Record<string, never>;

    expect(config.outputSchema.safeParse(structured).success).toBe(true);
    expect(structured.member).toEqual({
      id: "member-1",
      displayName: "Ada Lovelace",
      timezone: "Pacific/Kiritimati",
      locale: "en",
      durationDisplayFormat: "HOURS_MINUTES",
      profile: "CONTRACTOR",
    });
    expect(structured.today).toBe("2026-09-08");
    expect(structured.week).toEqual({ start: "2026-09-07", end: "2026-09-13" });
    expect(structured.scopes).toEqual(["time:read", "time:write"]);
    expect(structured.lockedMonths).toEqual(["2026-07", "2026-06"]);
  });

  /**
   * The member's own wording, passed through per project.
   *
   * Here so an agent logs "API endpoint implementation" rather than inventing "worked on the API":
   * these strings reach a report line and a contractor invoice, where a one-off phrasing among
   * thirty consistent ones is what a reviewer stops to ask about.
   */
  it("passes each project's recent descriptions through untouched", async () => {
    getMemberTrackingContext.mockResolvedValue(context());

    const { handler } = register(getContextTool, makeActor());
    const result = await handler();

    const structured = result.structuredContent as {
      projects: Array<{ id: string; recentDescriptions: string[] }>;
    };

    expect(structured.projects.map((project) => project.recentDescriptions)).toEqual([
      ["API endpoint implementation", "Sprint planning"],
      [],
    ]);
  });

  /**
   * The whole reason this tool exists. `today` has to be the member's calendar day, not the
   * process's — an agent handed a UTC date would log "today" onto the wrong day for anyone far
   * enough east or west, and neither it nor the member would notice until a timesheet was short.
   */
  it("passes the domain's timezone-derived today straight through", async () => {
    getMemberTrackingContext.mockResolvedValue(context({ today: "2026-01-01" }));

    const { handler } = register(getContextTool, makeActor());
    const result = await handler();

    expect((result.structuredContent as { today: string }).today).toBe("2026-01-01");
    expect(textOf(result)).toContain("Today is 2026-01-01");
  });

  it("marks a declared project as not loggable and says so in the text channel", async () => {
    getMemberTrackingContext.mockResolvedValue(context());

    const { handler } = register(getContextTool, makeActor());
    const result = await handler();

    const projects = (result.structuredContent as { projects: Array<Record<string, unknown>> })
      .projects;

    expect(projects.map((project) => [project.id, project.canLogTime])).toEqual([
      ["project-tracked", true],
      ["project-declared", false],
    ]);
    expect(textOf(result)).toContain("declares monthly");
  });

  /** A read-only connection has to be able to tell before it tries a write and collects a 403. */
  it("reports only the scopes the token actually holds", async () => {
    getMemberTrackingContext.mockResolvedValue(context());

    const { handler } = register(
      getContextTool,
      makeActor({ scopes: new Set(["time:read"]) as never }),
    );
    const result = await handler();

    expect((result.structuredContent as { scopes: string[] }).scopes).toEqual(["time:read"]);
  });

  it("reports a running timer with its elapsed minutes", async () => {
    /*
     * Frozen, because `elapsedMinutesFor` rounds UP: against the real clock a timer started exactly
     * 42 minutes ago reports 43 as soon as a single millisecond of the current minute has passed,
     * which makes the assertion a coin flip. The round-up itself is deliberate — it matches
     * `stopRunningTimer`, so the figure reported here is the figure a stop would actually save.
     */
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00.000Z"));

    const startedAt = "2026-09-08T11:18:00.000Z";

    getMemberTrackingContext.mockResolvedValue(
      context({
        runningTimer: {
          id: "timer-1",
          projectId: "project-tracked",
          projectAssignmentId: "assignment-1",
          projectName: "Atlas Platform",
          projectColor: "#0f766e",
          description: "Refactoring",
          startedAt,
        },
      }),
    );

    const { config, handler } = register(getContextTool, makeActor());
    const result = await handler();
    const structured = result.structuredContent as { runningTimer: Record<string, unknown> };

    expect(config.outputSchema.safeParse(structured).success).toBe(true);
    expect(structured.runningTimer.projectName).toBe("Atlas Platform");
    // Rounded up with a floor of one, matching `stopRunningTimer` — see `elapsedMinutesFor`.
    expect(structured.runningTimer.elapsedMinutes).toBe(42);
    // The member is on hours-and-minutes, so the quoted figure has to be "0:42", not "0.7".
    expect(textOf(result)).toContain("0:42");
  });

  it("says plainly when there is nothing assigned this month", async () => {
    getMemberTrackingContext.mockResolvedValue(context({ projects: [], lockedMonths: [] }));

    const { handler } = register(getContextTool, makeActor());
    const result = await handler();

    expect(textOf(result)).toContain("No projects are assigned for this month.");
    expect(textOf(result)).toContain("No locked months.");
  });

  it("maps a domain refusal onto its wire code rather than leaking the message", async () => {
    const { TimeTrackingError } = await import("@/src/server/time-tracking");

    getMemberTrackingContext.mockRejectedValue(
      new TimeTrackingError("Member not found.", "MEMBER_NOT_FOUND"),
    );

    const { handler } = register(getContextTool, makeActor());
    const result = await handler();

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe("MEMBER_NOT_FOUND");
  });
});
