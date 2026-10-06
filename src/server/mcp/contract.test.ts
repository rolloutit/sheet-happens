import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  CLIENT_CAPABILITIES_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import type { McpActor } from "./actor";
import type { McpScope } from "./scopes";
import { buildMcpHandler } from "./server";
import { TIME_TOOL_NAMES } from "./toolsets/time";

/**
 * The `tools/list` contract baseline.
 *
 * `src/server/mcp/__contract__/tools-list.json` is checked in and read in the diff, exactly like the
 * aria baselines in `e2e/__aria__`: it is every byte a connected client caches about this server, so
 * a change to a name, a description, a JSON Schema or an annotation is a change to the prompt every
 * agent is holding. Renaming an argument silently breaks conversations mid-flight.
 *
 * Regenerate deliberately, then read the diff before committing:
 *
 *   UPDATE_MCP_CONTRACT=1 pnpm test src/server/mcp/contract.test.ts
 *
 * The list is read back by making a real modern `tools/list` request against the production handler
 * rather than by inspecting the `McpServer` (which keeps `_registeredTools` private) or by capturing
 * a recording stand-in's `registerTool` calls. Both alternatives would record the *Zod* schemas and
 * leave the Zod → JSON Schema conversion — the part a client actually consumes, and the part most
 * likely to shift under a zod or SDK bump — untested.
 */
const BASELINE_PATH = path.join(process.cwd(), "src/server/mcp/__contract__/tools-list.json");

const MISMATCH =
  "tools/list no longer matches src/server/mcp/__contract__/tools-list.json. This is a client-visible " +
  "contract change: read the diff, and if it is intended regenerate the baseline with " +
  "`UPDATE_MCP_CONTRACT=1 pnpm test src/server/mcp/contract.test.ts` and commit it with the change.";

/**
 * The one revision the modern era serves. Hardcoded because the SDK does not export it: the closest
 * thing it exports, `LATEST_PROTOCOL_VERSION`, still names the last *legacy* revision (2025-11-25),
 * and sending that one here earns an "unsupported protocol version" 400.
 */
const MODERN_PROTOCOL_VERSION = "2026-07-28";

/** The four tools a `time:read`-only connection may see. Spelled out rather than derived. */
const READ_ONLY_TOOL_NAMES = [
  "time_get_context",
  "time_list_entries",
  "time_summary",
  "timer_status",
];

type ListedTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  annotations?: Record<string, boolean>;
  _meta?: Record<string, unknown>;
};

function actorWith(...scopes: McpScope[]): McpActor {
  return {
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
    scopes: new Set(scopes),
    clientId: "https://claude.ai/x",
    tokenId: "jti-1",
    requestMetadata: {
      ipAddress: null,
      userAgent: null,
      channel: "MCP",
      clientId: "https://claude.ai/x",
    },
    token: "t",
  };
}

/**
 * A 2026-07-28 `tools/list`, built the way the SDK's classifier demands: the `_meta` envelope is
 * what marks a request as modern, and a `MCP-Protocol-Version` header without it is a 400. The two
 * envelope keys come from the SDK so a future revision's rename arrives with the bump rather than as
 * a silent 400.
 */
async function listTools(actor: McpActor): Promise<ListedTool[]> {
  const response = await buildMcpHandler(actor).fetch(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": MODERN_PROTOCOL_VERSION,
        "Mcp-Method": "tools/list",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {
          _meta: {
            [PROTOCOL_VERSION_META_KEY]: MODERN_PROTOCOL_VERSION,
            [CLIENT_CAPABILITIES_META_KEY]: {},
          },
        },
      }),
    }),
  );

  const payload = (await response.json()) as { result?: { tools?: ListedTool[] } };

  if (response.status !== 200 || !payload.result?.tools) {
    throw new Error(`tools/list failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload.result.tools;
}

/**
 * Fixed key order, so the checked-in file diffs one field at a time. The SDK emits `_meta` between
 * `annotations` and `outputSchema` for the one tool that has it, which would otherwise make that
 * tool's entry the odd one out.
 */
function contractEntry(tool: ListedTool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    annotations: tool.annotations,
    ...(tool._meta ? { _meta: tool._meta } : {}),
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  };
}

describe("tools/list contract baseline", () => {
  it("matches the checked-in baseline", async () => {
    const tools = await listTools(actorWith("time:read", "time:write"));
    // Wrapped in an object rather than written as a bare array so a later addition to the result
    // (cache hints, an icon set) can join the file without rewriting its shape.
    const listed = { tools: tools.map(contractEntry) };

    if (process.env.UPDATE_MCP_CONTRACT === "1") {
      // Formatted through prettier, not `JSON.stringify`, because `pnpm format` checks this file
      // like any other — a regeneration that leaves it unformatted fails the gate it just passed.
      const { format, resolveConfig } = await import("prettier");
      const options = await resolveConfig(BASELINE_PATH);

      writeFileSync(
        BASELINE_PATH,
        await format(JSON.stringify(listed), { ...options, filepath: BASELINE_PATH }),
      );
    }

    expect(listed, MISMATCH).toEqual(
      JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as typeof listed,
    );
  });
});

/**
 * Asserted independently of the snapshot. A baseline regenerated without reading the diff would
 * absorb any of these, and each one is a rule an agent's behaviour depends on rather than a detail.
 */
describe("tools/list invariants", () => {
  it("lists every time tool, in registration order", async () => {
    const tools = await listTools(actorWith("time:read", "time:write"));

    expect(tools.map((tool) => tool.name)).toEqual(TIME_TOOL_NAMES);
  });

  it("names every tool in the time_ or timer_ namespace", async () => {
    const tools = await listTools(actorWith("time:read", "time:write"));

    for (const tool of tools) {
      expect(tool.name).toMatch(/^(time|timer)_/);
    }
  });

  /** A tool with no description is a tool the model guesses at. */
  it("describes and titles every tool", async () => {
    const tools = await listTools(actorWith("time:read", "time:write"));

    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description?.trim(), tool.name).toBeTruthy();
    }
  });

  /**
   * The spec's client-side reading of an absent `openWorldHint` is the pessimistic one, so leaving
   * it off would make every tool here look like it reaches the open internet. It reaches one
   * Postgres database the member already owns.
   */
  it("declares openWorldHint false on every tool", async () => {
    const tools = await listTools(actorWith("time:read", "time:write"));

    for (const tool of tools) {
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false);
    }
  });

  /**
   * Exactly one tool forces a human click. Adding a second would put friction on an action members
   * do not regret; losing this one would let an agent sweep a week of entries unattended.
   */
  it("requires user interaction for time_delete_entry alone", async () => {
    const tools = await listTools(actorWith("time:read", "time:write"));

    const gated = tools.filter((tool) => tool._meta?.["anthropic/requiresUserInteraction"]);

    expect(gated.map((tool) => tool.name)).toEqual(["time_delete_entry"]);
    expect(gated[0]?._meta).toEqual({ "anthropic/requiresUserInteraction": true });
  });

  /** A read-only connection must not even be told the mutating tools exist. */
  it("hides every write tool from a time:read-only actor", async () => {
    const tools = await listTools(actorWith("time:read"));

    expect(tools.map((tool) => tool.name)).toEqual(READ_ONLY_TOOL_NAMES);
  });
});
