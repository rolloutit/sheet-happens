import { McpServer } from "@modelcontextprotocol/server";

import type { McpActor } from "./actor";
import type { McpToolScope } from "./scopes";
import { timeToolset } from "./toolsets/time";

/**
 * A toolset is the unit of extension.
 *
 * Adding `admin` or `timesheets` later is a folder, a scope, and one line in `TOOLSETS` — the
 * transport, auth, actor and error layers do not change. `isAllowed` is where a role gate goes;
 * `requiredScope` is checked first, so a token that never asked for the scope never even sees the
 * tools exist.
 */
export type Toolset = {
  id: string;
  requiredScope: McpToolScope;
  /**
   * Static tool name -> scope map. The route gates a write attempt on a read-only token BEFORE the
   * per-request server exists, so this cannot be derived from the actor.
   */
  toolScopes: Readonly<Record<string, McpToolScope>>;
  isAllowed?: (actor: McpActor) => boolean;
  register: (server: McpServer, actor: McpActor) => void;
};

/**
 * Fixed order, and the tool files inside each toolset register in a fixed order too.
 *
 * `tools/list` is part of a client's prompt cache. A list whose order wobbles between requests
 * invalidates that cache on every call, which the spec asks servers to avoid — so nothing here may
 * depend on iteration order of a map or on a database read.
 */
export const TOOLSETS: readonly Toolset[] = [timeToolset];

export const MCP_SERVER_INFO = {
  name: "sheet-happens",
  title: "Sheet Happens",
  version: "1.0.0",
  description: "Time tracking for Sheet Happens: log, correct and review your own hours.",
} as const;

/**
 * Instructions the client may show the model before it picks a tool. Kept to the two rules that
 * cause the most failed calls.
 */
const INSTRUCTIONS = [
  "Sheet Happens tracks one member's own working time. Every tool acts as the signed-in member and",
  "cannot read or write anyone else's hours.",
  "",
  "Call time_get_context first. It returns today's date in the member's timezone, the valid project",
  "ids, which months are locked, and whether a timer is running. Dates are YYYY-MM-DD in that",
  "timezone and are never relative — work out the date yourself from the context.",
  "",
  "Two rules cause most refusals: a month with a submitted timesheet is locked and cannot be",
  "changed, and a project that declares its hours monthly cannot take individual entries.",
].join("\n");

/**
 * The scope a named tool needs, or `null` for a name no toolset owns.
 *
 * A `null` deliberately does NOT become a 403: an unknown tool is the SDK's business, and it answers
 * with a proper JSON-RPC "tool not found" that tells the model far more than a scope challenge.
 */
export function scopeForTool(toolName: string): McpToolScope | null {
  for (const toolset of TOOLSETS) {
    const scope = toolset.toolScopes[toolName];
    if (scope) return scope;
  }

  return null;
}

/**
 * The scope this HTTP request needs, read without consuming the body stream.
 *
 * Both eras have to be covered. A 2026-07-28 client is required to send `Mcp-Name` mirroring
 * `params.name` and the SDK rejects a mismatch, so the header alone is authoritative there. A legacy
 * client sends no such header, so the parsed body is the only source — hence the `body` argument
 * rather than a second read of `request`.
 *
 * Anything that is not a `tools/call` needs only the toolset-level read scope, which
 * `requireMcpAuth`-equivalent verification has already enforced; returning `null` lets those
 * through.
 */
export function requiredScopeForRequest(request: Request, body: unknown): McpToolScope | null {
  const header = request.headers.get("mcp-name");

  if (header) {
    return scopeForTool(header);
  }

  const toolName = readLegacyToolName(body);

  return toolName ? scopeForTool(toolName) : null;
}

function readLegacyToolName(body: unknown): string | null {
  // A legacy client may batch, in which case the strictest scope among the calls is the one to
  // demand — granting on the first element would let a write ride along behind a read.
  const messages = Array.isArray(body) ? body : [body];
  let name: string | null = null;

  for (const message of messages) {
    if (!message || typeof message !== "object") continue;

    const record = message as { method?: unknown; params?: unknown };
    if (record.method !== "tools/call") continue;

    const params = record.params as { name?: unknown } | undefined;
    if (typeof params?.name !== "string") continue;

    if (scopeForTool(params.name) === "time:write") return params.name;
    name ??= params.name;
  }

  return name;
}

export function buildServer(actor: McpActor): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    instructions: INSTRUCTIONS,
    /*
     * The tool list is built per request from this actor's scopes and role, so it is not shareable
     * between callers — `private` is the only correct scope. `ttlMs: 0` because the list also
     * depends on the member's project assignments changing underneath: a stale list would offer a
     * project id that no longer resolves.
     */
    cacheHints: {
      "tools/list": { ttlMs: 0, cacheScope: "private" },
      "server/discover": { ttlMs: 0, cacheScope: "private" },
    },
  });

  for (const toolset of TOOLSETS) {
    if (!actor.scopes.has(toolset.requiredScope)) continue;
    if (toolset.isAllowed && !toolset.isAllowed(actor)) continue;

    toolset.register(server, actor);
  }

  return server;
}
