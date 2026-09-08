import { auth } from "@/src/server/auth/auth";

/**
 * RFC 9728 protected resource metadata, at the path-suffixed URL Claude probes first — and the exact
 * URL `@better-auth/mcp` names in its own 401 `WWW-Authenticate: … resource_metadata="…"`.
 *
 * The document is rendered by the `mcp()` plugin, not by us, so `resource`, `authorization_servers`,
 * `scopes_supported` and `bearer_methods_supported` cannot drift from the plugin's actual
 * configuration. Reaching it needs this thin route because the plugin serves the document from an
 * `onRequest` hook that matches the FULL request pathname: it fires for
 * `/.well-known/oauth-protected-resource/api/mcp` and NOT for anything under `basePath`, so a
 * `next.config.ts` rewrite into `/api/auth/...` would miss it. Handing `auth.handler` the untouched
 * request is what makes the match succeed.
 */
export function GET(request: Request) {
  return auth.handler(request);
}
