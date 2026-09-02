import { AuthenticationError, AuthorizationError } from "./session";

/**
 * Classifies the two errors every `require*AppMemberForAction` guard throws: 401 when there is no
 * session at all, 403 when there is a session that may not act — an unverified second factor,
 * incomplete security setup, a non-admin, or an inactive/deleted member.
 *
 * `null` means the error came from somewhere else and the caller still owns it: a domain error it
 * maps itself (a missing avatar is a 404), or an unexpected DB/storage failure that must not be
 * reported as an auth problem. Route handlers each inlined this mapping and drifted apart, so the
 * classification lives here while every route keeps its own response body.
 */
export function authErrorStatus(error: unknown): 401 | 403 | null {
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof AuthorizationError) return 403;
  return null;
}
