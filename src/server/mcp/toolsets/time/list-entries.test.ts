import type { CallToolResult } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { formatDateOnly, type MemberTimeEntryRow } from "@/src/server/time-tracking";

import type { McpActor } from "../../actor";
import type { McpTool } from "../../tool";

const listMemberTimeEntries = vi.fn();

/*
 * Only the query is stubbed. Spreading the original keeps `parseDateOnly` and `formatDateOnly` real,
 * which matters here: the range cap and the reversed-range check are date arithmetic, and a stubbed
 * calendar would let a broken span calculation pass.
 */
vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listMemberTimeEntries: (...args: unknown[]) => listMemberTimeEntries(...args),
}));

const { listEntriesTool } = await import("./list-entries");

type RegisteredConfig = {
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  annotations: Record<string, boolean>;
};

type RegisteredHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

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

function register(tool: McpTool, registeringActor: McpActor) {
  let config: RegisteredConfig | undefined;
  let handler: RegisteredHandler | undefined;

  const server = {
    registerTool: (_name: string, toolConfig: RegisteredConfig, toolHandler: RegisteredHandler) => {
      config = toolConfig;
      handler = toolHandler;
    },
  };

  tool.register(server as never, registeringActor);

  if (!config || !handler) {
    throw new Error("The tool did not register itself.");
  }

  return { config, handler };
}

/**
 * Arguments reach a real handler already validated by the SDK, which is also where `default()` is
 * applied. Parsing through the tool's own `inputSchema` keeps the test on that path instead of
 * hand-filling the defaults — so an argument the schema would have rejected or filled differently
 * cannot pass here.
 */
async function callTool(args: Record<string, unknown>) {
  const { config, handler } = register(listEntriesTool, actor);
  const result = await handler(config.inputSchema.parse(args) as Record<string, unknown>);

  return { config, result };
}

function textOf(result: CallToolResult) {
  return (result.content ?? [])
    .map((block) => ("text" in block && typeof block.text === "string" ? block.text : ""))
    .join("\n");
}

function domainInput() {
  const [input] = listMemberTimeEntries.mock.calls[0] as [Record<string, unknown>];

  return input;
}

const timedEntry: MemberTimeEntryRow = {
  id: "entry-1",
  date: "2026-03-02",
  projectId: "project-apollo",
  projectName: "Apollo",
  durationMinutes: 90,
  startTime: "09:00",
  endTime: "10:30",
  description: "Standup and planning",
  source: "GRID",
  locked: false,
  updatedAt: "2026-03-02T09:31:00.000Z",
};

const durationEntry: MemberTimeEntryRow = {
  id: "entry-2",
  date: "2026-03-03",
  projectId: "project-apollo",
  projectName: "Apollo",
  durationMinutes: 45,
  startTime: null,
  endTime: null,
  description: "Release notes",
  source: "FORM",
  locked: false,
  updatedAt: "2026-03-03T16:02:00.000Z",
};

function pageOf(entries: MemberTimeEntryRow[], nextCursor: string | null = null) {
  return {
    range: { from: "2026-03-01", to: "2026-03-31" },
    entries,
    totals: {
      minutes: entries.reduce((total, entry) => total + entry.durationMinutes, 0),
      entryCount: entries.length,
    },
    nextCursor,
  };
}

beforeEach(() => {
  listMemberTimeEntries.mockReset();
});

describe("time_list_entries", () => {
  it("returns the page, its totals and one line per entry", async () => {
    listMemberTimeEntries.mockResolvedValue(pageOf([timedEntry, durationEntry]));

    const { config, result } = await callTool({ from: "2026-03-01", to: "2026-03-31" });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      range: { from: "2026-03-01", to: "2026-03-31" },
      entries: [
        {
          id: "entry-1",
          date: "2026-03-02",
          projectId: "project-apollo",
          projectName: "Apollo",
          durationMinutes: 90,
          durationText: "1.5",
          startTime: "09:00",
          endTime: "10:30",
          description: "Standup and planning",
          source: "GRID",
          locked: false,
          updatedAt: "2026-03-02T09:31:00.000Z",
        },
        {
          id: "entry-2",
          date: "2026-03-03",
          projectId: "project-apollo",
          projectName: "Apollo",
          durationMinutes: 45,
          durationText: "0.75",
          startTime: null,
          endTime: null,
          description: "Release notes",
          source: "FORM",
          locked: false,
          updatedAt: "2026-03-03T16:02:00.000Z",
        },
      ],
      totals: { minutes: 135, minutesText: "2.25", entryCount: 2 },
      nextCursor: null,
    });

    // The check that catches a schema/handler drift, which is otherwise invisible until the SDK
    // validates a real result on the wire.
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);

    const text = textOf(result);

    expect(text).toContain("2026-03-02 09:00-10:30  1.5  Apollo  Standup and planning  (entry-1)");
    expect(text).toContain("2026-03-03  0.75  Apollo  Release notes  (entry-2)");
    expect(text).toContain("Page total: 2 entries, 2.25.");
    expect(text).toContain("this page only, not the range");

    const input = domainInput();

    expect(input.memberId).toBe("member-1");
    expect(formatDateOnly(input.from as Date)).toBe("2026-03-01");
    expect(formatDateOnly(input.to as Date)).toBe("2026-03-31");
    // Defaults, straight from the schema: declared months out, one full page.
    expect(input.includeDeclared).toBe(false);
    expect(input.limit).toBe(100);
    expect(input.projectId).toBeUndefined();
    expect(input.cursor).toBeUndefined();
  });

  it("spells out that the page is not the range and how to reach the next one", async () => {
    listMemberTimeEntries.mockResolvedValue(pageOf([timedEntry], "cursor-page-2"));

    const { result } = await callTool({ from: "2026-03-01", to: "2026-03-31" });

    expect(result.structuredContent).toMatchObject({ nextCursor: "cursor-page-2" });
    expect(textOf(result)).toContain("cursor=cursor-page-2");
  });

  it("refuses a range wider than the cap without touching the database", async () => {
    const { result } = await callTool({ from: "2026-01-01", to: "2026-06-30" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "RANGE_TOO_LARGE",
      details: { requestedDays: 181, maxDays: 92 },
    });
    // The point of validating first: a range no answer can be given for costs no query.
    expect(listMemberTimeEntries).not.toHaveBeenCalled();
    expect(textOf(result)).toContain("cursor");
  });

  it("refuses a reversed range rather than reporting it as empty", async () => {
    const { result } = await callTool({ from: "2026-03-31", to: "2026-03-01" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "VALIDATION",
      details: { from: "2026-03-31", to: "2026-03-01" },
    });
    expect(listMemberTimeEntries).not.toHaveBeenCalled();
  });

  it("clamps a limit outside the allowed range instead of failing", async () => {
    listMemberTimeEntries.mockResolvedValue(pageOf([]));

    await callTool({ from: "2026-03-01", to: "2026-03-31", limit: 5000 });
    expect(domainInput().limit).toBe(200);

    listMemberTimeEntries.mockClear();

    await callTool({ from: "2026-03-01", to: "2026-03-31", limit: 0 });
    expect(domainInput().limit).toBe(1);
  });

  it("forwards the projectId filter and includeDeclared", async () => {
    listMemberTimeEntries.mockResolvedValue(pageOf([]));

    const { result } = await callTool({
      from: "2026-03-01",
      to: "2026-03-31",
      projectId: "project-apollo",
      includeDeclared: true,
      cursor: "cursor-page-2",
    });

    expect(domainInput()).toMatchObject({
      memberId: "member-1",
      projectId: "project-apollo",
      includeDeclared: true,
      cursor: "cursor-page-2",
    });
    expect(textOf(result)).toContain("No entries between 2026-03-01 and 2026-03-31.");
  });

  it("registers as a read-only tool", async () => {
    const { config } = register(listEntriesTool, actor);

    // Written out rather than compared against READ_ONLY_ANNOTATIONS: importing the constant would
    // assert the tool passes whatever it passes, and a client reads an absent hint pessimistically.
    expect(config.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(listEntriesTool.scope).toBe("time:read");
    expect(listEntriesTool.name).toBe("time_list_entries");
  });

  it("rejects an unknown argument so a guessed API is corrected", async () => {
    const { config } = register(listEntriesTool, actor);

    expect(
      config.inputSchema.safeParse({ from: "2026-03-01", to: "2026-03-31", project: "Apollo" })
        .success,
    ).toBe(false);
  });
});
