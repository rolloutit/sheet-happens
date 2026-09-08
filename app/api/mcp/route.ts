import { createMcpProtectedRequestHandler } from "@better-auth/mcp";
import { originValidationResponse } from "@modelcontextprotocol/server";
import { createDpopReplayStore, createInsufficientScopeError } from "better-auth/oauth2";

import { auth } from "@/src/server/auth/auth";
import { authHostname, authUrls } from "@/src/server/auth/auth-urls";
import {
  authInfoFor,
  buildMcpHandler,
  McpInvalidTokenError,
  mcpRateLimit,
  requiredScopeForRequest,
  resolveMcpActor,
} from "@/src/server/mcp";
import { MCP_CHALLENGE_SCOPES } from "@/src/server/mcp/scopes";

/*
 * No `export const dynamic` and no `export const runtime`: Next 16 does not cache route handlers by
 * default, a file exporting POST is excluded from static generation outright, and the shipped docs
 * say to drop the deprecated `runtime` export. Both would be dead weight here.
 */

/**
 * Hostnames a browser `Origin` may claim. Anthropic's servers and Claude Code send no `Origin` at
 * all and pass through; a *present* foreign one is a DNS-rebinding attempt and is refused, which is
 * a spec MUST. The SDK's entry is deliberately validation-free, so this is ours to do.
 */
const allowedOriginHostnames = [authHostname, "localhost", "127.0.0.1", "[::1]"];

const RESOURCE_METADATA_URL = `${authUrls.origin}/.well-known/oauth-protected-resource/api/mcp`;

/**
 * `createMcpProtectedRequestHandler` rather than `requireMcpAuth`.
 *
 * `requireMcpAuth` derives the issuer, audience and JWKS URL from `(await auth.$context).baseURL`,
 * which Better Auth leaves EMPTY whenever `baseURL` is a dynamic config — which this app uses in
 * every non-production environment. It would also default the expected audience to the auth base
 * URL rather than the MCP resource, so no token would ever verify. Passing all three explicitly is
 * the documented escape hatch and behaves identically in every environment.
 *
 * The JWKS is fetched over HTTP from this same app. It is cached in-process for five minutes, so
 * this is a handful of self-requests a day, not one per call.
 */
let protectedHandlerPromise: Promise<(request: Request) => Promise<Response>> | null = null;

/**
 * Built once, on the first request rather than at module load.
 *
 * The DPoP replay store needs `auth.$context`, which is a promise — resolving it at module scope
 * would mean a top-level `await` in a route file, and it would move Better Auth's plugin
 * initialisation (including the OAuth resource seed, a database write) into module evaluation.
 */
function getProtectedHandler() {
  protectedHandlerPromise ??= buildProtectedHandler();

  return protectedHandlerPromise;
}

async function buildProtectedHandler() {
  const { internalAdapter } = await auth.$context;

  return createMcpProtectedRequestHandler(
    {
      issuer: authUrls.issuer,
      audience: authUrls.mcpResource,
      jwksUrl: authUrls.jwks,
      /*
       * Enforced on every request: a token that never asked for `time:read` cannot reach a tool. The
       * challenge advertises both v1 scopes rather than just the missing one, because Claude does not
       * reliably carry earlier scopes into a step-up consent — asked for `time:write` alone, it can
       * come back holding only that and lose its reads.
       */
      requiredScopes: ["time:read"],
      challengeScopes: [...MCP_CHALLENGE_SCOPES],
      dpop: {
        /*
         * Claude does not use DPoP today, but the verifier still enforces a proof when a client
         * sends one, and replay detection needs somewhere to record spent `jti`s. Without a store
         * the default is in-memory and would forget across instances; the adapter-backed one uses
         * the existing `verification` table.
         */
        replayStore: createDpopReplayStore(internalAdapter),
      },
    },
    async (request, claims) => {
      const actor = await resolveMcpActor(claims, request);

      // Read the body once and hand the parsed value to the SDK, rather than cloning the request
      // and parsing twice. A body that is not JSON is left for the SDK, which answers with the
      // correct JSON-RPC parse error.
      let body: unknown = undefined;
      let parsed = false;

      try {
        body = await request.clone().json();
        parsed = true;
      } catch {
        parsed = false;
      }

      const needed = requiredScopeForRequest(request, body);

      if (needed && !actor.scopes.has(needed)) {
        // Thrown, not returned: the handler wrapper recognises this specific error and renders the
        // RFC 6750 `insufficient_scope` challenge with the right status and headers.
        throw createInsufficientScopeError([needed]);
      }

      const limited = mcpRateLimit.check(actor.member.id);

      if (!limited.allowed) {
        return jsonRpcError(429, `Rate limit exceeded. Retry in ${limited.retryAfterSeconds}s.`, {
          "Retry-After": String(limited.retryAfterSeconds),
        });
      }

      return buildMcpHandler(actor).fetch(request, {
        authInfo: authInfoFor(actor),
        ...(parsed ? { parsedBody: body } : {}),
      });
    },
  );
}

export async function POST(request: Request) {
  const originRefusal = originValidationResponse(request, allowedOriginHostnames);

  if (originRefusal) {
    return originRefusal;
  }

  try {
    const handler = await getProtectedHandler();

    return await handler(request);
  } catch (error) {
    if (error instanceof McpInvalidTokenError) {
      /*
       * A structurally valid token whose member is gone, deactivated or unlinked. A 401 makes the
       * client discard it and re-run the OAuth flow, where it fails at login — the correct end
       * state. A 200 with `isError` would leave it retrying with a token that can never work.
       */
      return jsonRpcError(401, error.message, {
        "WWW-Authenticate":
          `Bearer error="invalid_token", ` +
          `error_description="${error.message}", ` +
          `resource_metadata="${RESOURCE_METADATA_URL}", ` +
          `scope="${MCP_CHALLENGE_SCOPES.join(" ")}"`,
      });
    }

    console.error("[mcp] request failed", error);

    return jsonRpcError(500, "Sheet Happens could not complete the request.");
  }
}

/**
 * The 2026-07-28 transport is POST-only and the SDK already answers every other verb with a 405.
 * Answering here instead keeps an unauthenticated browser visit from getting a confusing 401 on a
 * URL that would never have worked as a GET anyway.
 */
export function GET() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}

function methodNotAllowed() {
  return jsonRpcError(405, "Method not allowed.", { Allow: "POST" });
}

/**
 * Failures on this endpoint are JSON-RPC envelopes, not plain JSON errors — that is what an MCP
 * client parses, and it is the shape `@better-auth/mcp` uses for its own challenges. `-32000` is the
 * transport-level code it uses too.
 */
function jsonRpcError(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message }, id: null },
    { status, headers },
  );
}
