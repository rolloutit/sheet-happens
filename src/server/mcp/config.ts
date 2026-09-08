/**
 * MCP tunables. Import-free on purpose (like `scopes.ts`) so `auth.ts`, the route handler and the
 * unit tests can share them without pulling Prisma or Better Auth into a test process.
 */

/**
 * Dynamic Client Registration (RFC 7591). Off in production: the MCP spec deprecated it in favour of
 * Client ID Metadata Documents, it grows the client table by one row per fresh connection, and
 * Claude only picks it when CIMD is unavailable. It stays on locally and in the e2e database so the
 * MCP Inspector and the OAuth e2e spec can register themselves.
 *
 * `MCP_ALLOW_DYNAMIC_CLIENT_REGISTRATION` overrides the default in both directions — the deployed
 * environments all run with `NODE_ENV=production` (the Dockerfile hardcodes it, PR previews
 * included), so without the override there would be no way to try the Inspector against the
 * development deployment.
 */
export function isDynamicClientRegistrationEnabled() {
  const configured = process.env.MCP_ALLOW_DYNAMIC_CLIENT_REGISTRATION;

  if (configured === "true") {
    return true;
  }

  if (configured === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

/**
 * Per-member sliding window on the MCP endpoint. An agent turn makes a handful of calls; abuse is
 * bounded by OAuth anyway. Counted in memory, which is exact today (one instance per environment)
 * and an under-count rather than an over-count if that ever changes.
 */
export const MCP_RATE_LIMIT = {
  windowMs: 60_000,
  max: 120,
} as const;

/** Argument bounds shared by the tools and their descriptions. */
export const MCP_LIMITS = {
  /** `time_list_entries` range cap, in days. */
  listRangeDays: 92,
  /** `time_summary` range cap, in days. */
  summaryRangeDays: 366,
  listPageSize: 100,
  listPageSizeMax: 200,
  /** Mirrors the domain layer's own description bound. */
  descriptionMaxLength: 1000,
  /** The grid's soft "long day" warning, in minutes. */
  dailySoftWarningMinutes: 8 * 60,
  /** The domain layer's hard daily cap, in minutes. */
  dailyHardLimitMinutes: 24 * 60,
} as const;
