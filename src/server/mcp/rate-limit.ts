import { MCP_RATE_LIMIT } from "./config";

/**
 * A per-member sliding window over the MCP endpoint.
 *
 * In memory on purpose. There is one instance per environment today, and the alternative — a table
 * write per tool call — would cost more than the abuse it prevents, on an endpoint already behind
 * OAuth. The interface is the part that matters: swapping in a table-backed or Redis-backed store
 * later means implementing `McpRateLimiter` and changing one line in the route.
 *
 * Keyed by member, not by token or IP: a member connecting Claude on three devices holds three
 * tokens and should still get one budget, and every request from Claude.ai arrives from Anthropic's
 * address range so an IP bucket would be shared by the whole company.
 */
export type McpRateLimitVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type McpRateLimiter = {
  check: (key: string, now?: number) => McpRateLimitVerdict;
  reset: () => void;
};

export function createMcpRateLimiter(
  options: { windowMs?: number; max?: number } = {},
): McpRateLimiter {
  const windowMs = options.windowMs ?? MCP_RATE_LIMIT.windowMs;
  const max = options.max ?? MCP_RATE_LIMIT.max;
  const hits = new Map<string, number[]>();

  return {
    check(key, now = Date.now()) {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);

      if (recent.length >= max) {
        // The oldest hit still inside the window is what has to age out before there is room, so
        // this is the true wait rather than a flat guess. Rounded up: a `Retry-After: 0` would
        // invite an immediate retry that fails again.
        const oldest = recent[0] ?? now;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

        hits.set(key, recent);

        return { allowed: false, retryAfterSeconds };
      }

      recent.push(now);
      hits.set(key, recent);

      // Bound the map. Without this a long-lived process accumulates one array per member that ever
      // called, forever. Any key whose whole window has aged out is dead weight.
      if (hits.size > 1000) {
        for (const [existingKey, timestamps] of hits) {
          if (timestamps.every((at) => at <= cutoff)) {
            hits.delete(existingKey);
          }
        }
      }

      return { allowed: true };
    },
    reset() {
      hits.clear();
    },
  };
}

/** The process-wide limiter the route uses. Tests build their own with `createMcpRateLimiter`. */
export const mcpRateLimit = createMcpRateLimiter();
