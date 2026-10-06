import type { CallToolResult } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import type { McpActor } from "../../actor";
import type { McpTool } from "../../tool";

const getMemberTimeEntry = vi.fn();
const deleteTimeEntry = vi.fn();
const listMemberTimeEntries = vi.fn();

/*
 * Only the reads and the write are stubbed; the original module is spread back in so `parseDateOnly`
 * and the rest of the date helpers `shared.ts` uses stay real. Faking those too would let a date bug
 * pass here and fail in production.
 */
vi.mock("@/src/server/time-tracking", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getMemberTimeEntry: (...args: unknown[]) => getMemberTimeEntry(...args),
  deleteTimeEntry: (...args: unknown[]) => deleteTimeEntry(...args),
  listMemberTimeEntries: (...args: unknown[]) => listMemberTimeEntries(...args),
}));

const { deleteEntryTool } = await import("./delete-entry");

type Registration = {
  config: {
    title?: string;
    description?: string;
    inputSchema: z.ZodType;
    outputSchema: z.ZodType;
    annotations?: Record<string, boolean>;
    _meta?: Record<string, unknown>;
  };
  handler: (args: { entryId: string }) => Promise<CallToolResult>;
};

/** Drives the tool the way the SDK does: capture what it registers, then call the handler. */
function register(tool: McpTool, actorForRegistration: McpActor): Registration {
  const registrations: Registration[] = [];

  const server = {
    registerTool: (
      _name: string,
      config: Registration["config"],
      handler: Registration["handler"],
    ) => registrations.push({ config, handler }),
  };

  tool.register(server as never, actorForRegistration);

  const registration = registrations[0];

  if (!registration) {
    throw new Error("time_delete_entry did not register itself.");
  }

  return registration;
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

const ENTRY = {
  id: "entry-1",
  date: "2026-03-04",
  projectId: "project-1",
  projectName: "Atlas",
  durationMinutes: 120,
  startTime: "09:00",
  endTime: "11:00",
  description: "Pairing on the importer",
  source: "MCP",
  locked: false,
  updatedAt: "2026-03-04T11:02:00.000Z",
};

/** The day as the read path sees it *after* the soft delete: 300 of the original 420 minutes left. */
function dayPageAfterDelete() {
  return {
    range: { from: ENTRY.date, to: ENTRY.date },
    entries: [],
    totals: { minutes: 300, entryCount: 2 },
    nextCursor: null,
  };
}

function textOf(result: CallToolResult) {
  return (result.content ?? [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");
}

describe("time_delete_entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the entry before deleting it, then reports the day total from after the delete", async () => {
    getMemberTimeEntry.mockResolvedValue(ENTRY);
    deleteTimeEntry.mockResolvedValue({ id: ENTRY.id });
    listMemberTimeEntries.mockResolvedValue(dayPageAfterDelete());

    const { config, handler } = register(deleteEntryTool, actor);
    const result = await handler({ entryId: "entry-1" });

    expect(result.isError).toBeUndefined();

    /*
     * The ordering is the whole design of this tool: a soft-deleted row is invisible to
     * `getMemberTimeEntry`, so a pre-read is the only way the echo is non-empty — and the day total
     * is only correct if its listing runs after the write.
     */
    expect(getMemberTimeEntry.mock.invocationCallOrder[0]).toBeLessThan(
      deleteTimeEntry.mock.invocationCallOrder[0],
    );
    expect(deleteTimeEntry.mock.invocationCallOrder[0]).toBeLessThan(
      listMemberTimeEntries.mock.invocationCallOrder[0],
    );

    expect(result.structuredContent).toEqual({
      deleted: {
        id: "entry-1",
        date: "2026-03-04",
        projectId: "project-1",
        projectName: "Atlas",
        durationMinutes: 120,
        durationText: "2",
        startTime: "09:00",
        endTime: "11:00",
        description: "Pairing on the importer",
        source: "MCP",
        locked: false,
        updatedAt: "2026-03-04T11:02:00.000Z",
      },
      day: { date: "2026-03-04", totalMinutes: 300, totalText: "5", overSoftLimit: false },
      restorable: true,
    });

    // The check that catches a schema/handler drift, which is otherwise invisible until the SDK
    // validates the result on a live call.
    expect(config.outputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  it("names the restore tool in the text channel", async () => {
    getMemberTimeEntry.mockResolvedValue(ENTRY);
    deleteTimeEntry.mockResolvedValue({ id: ENTRY.id });
    listMemberTimeEntries.mockResolvedValue(dayPageAfterDelete());

    const { handler } = register(deleteEntryTool, actor);
    const text = textOf(await handler({ entryId: "entry-1" }));

    // A text-only client would otherwise show a bare "deleted", and an agent that believes a delete
    // is permanent starts refusing reasonable requests.
    expect(text).toContain("time_restore_entry");
    expect(text).toContain("entry-1");
    expect(text).toContain("5");
  });

  it("passes the actor's own member id as both memberId and actorMemberId", async () => {
    getMemberTimeEntry.mockResolvedValue(ENTRY);
    deleteTimeEntry.mockResolvedValue({ id: ENTRY.id });
    listMemberTimeEntries.mockResolvedValue(dayPageAfterDelete());

    const { handler } = register(deleteEntryTool, actor);
    await handler({ entryId: "entry-1" });

    // A differing `actorMemberId` is how the domain layer recognises an admin correction. Equal ids
    // are the structural proof an MCP token can only ever delete its own member's time.
    expect(deleteTimeEntry).toHaveBeenCalledWith({
      memberId: "member-1",
      actorMemberId: "member-1",
      timeEntryId: "entry-1",
      requestMetadata: actor.requestMetadata,
    });
    expect(getMemberTimeEntry).toHaveBeenCalledWith({
      memberId: "member-1",
      timeEntryId: "entry-1",
    });
  });

  it("fails with ENTRY_NOT_FOUND without attempting the delete", async () => {
    getMemberTimeEntry.mockResolvedValue(null);

    const { handler } = register(deleteEntryTool, actor);
    const result = await handler({ entryId: "ghost" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "ENTRY_NOT_FOUND",
      details: { entryId: "ghost" },
    });
    expect(deleteTimeEntry).not.toHaveBeenCalled();
    expect(listMemberTimeEntries).not.toHaveBeenCalled();
  });

  it("declares the destructive update annotations and requires user interaction", async () => {
    const { config } = register(deleteEntryTool, actor);

    // Spelled out rather than compared to the exported constant: the point is the hint *values* a
    // client reads, so swapping in WRITE_ANNOTATIONS has to fail here.
    expect(config.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });

    // The one tool in the server that forces a confirmation click whatever the auto-approve setting.
    expect(config._meta).toEqual({ "anthropic/requiresUserInteraction": true });
  });

  it("rejects an unknown argument", async () => {
    const { config } = register(deleteEntryTool, actor);

    expect(config.inputSchema.safeParse({ entryId: "entry-1" }).success).toBe(true);
    // `.strict()` everywhere: a stray argument means the model has invented an API, and failing
    // loudly is how it learns the real one on the next turn.
    expect(config.inputSchema.safeParse({ entryId: "entry-1", hard: true }).success).toBe(false);
  });
});
