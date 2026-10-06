import { auth } from "@/src/server/auth/auth";

/**
 * The root form of the protected resource metadata. `@better-auth/mcp` serves the same document at
 * both this path and the resource-suffixed one; a client that has only the origin can start here.
 * See the suffixed route for why this delegates rather than rewrites.
 */
export function GET(request: Request) {
  return auth.handler(request);
}
