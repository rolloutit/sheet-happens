import { createMcpHandler } from "@modelcontextprotocol/server";

import { toAuthInfo, type McpActor } from "./actor";
import { buildServer } from "./registry";

/**
 * The dual-era HTTP entry point.
 *
 * `legacy: "stateless"` is what makes one endpoint serve both protocol eras. A request carrying the
 * 2026-07-28 `_meta` envelope is served statelessly per that revision; an older client's
 * `initialize` handshake is answered and every one of its requests is served from a fresh server
 * instance with no session id. Either way there is no session store, no Redis and no sticky
 * routing — one Railway instance and a future scale-out behave identically.
 *
 * The factory runs once per request, which is what lets `tools/list` reflect the caller: a member
 * never sees an admin tool because the server that would have listed it was never built.
 */
export function buildMcpHandler(actor: McpActor) {
  return createMcpHandler(() => buildServer(actor), {
    legacy: "stateless",
    onerror: (error) => {
      console.error("[mcp] transport error", error);
    },
  });
}

export function authInfoFor(actor: McpActor) {
  return toAuthInfo(actor);
}
