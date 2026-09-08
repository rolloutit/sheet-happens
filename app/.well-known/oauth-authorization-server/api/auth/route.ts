import { auth } from "@/src/server/auth/auth";

/**
 * RFC 8414 authorization server metadata at the *path-inserted* alias.
 *
 * The issuer is `<origin>/api/auth`, so RFC 8414 says a client may look under
 * `<origin>/.well-known/oauth-authorization-server/api/auth` while OpenID Connect discovery appends
 * instead, at `<origin>/api/auth/.well-known/openid-configuration`. The appended forms already land
 * on the Better Auth catch-all; this is the inserted one, and Claude tries it.
 *
 * The provider's discovery hook accepts both shapes when it sees the whole pathname, which is why
 * this hands over the request unchanged.
 */
export function GET(request: Request) {
  return auth.handler(request);
}
