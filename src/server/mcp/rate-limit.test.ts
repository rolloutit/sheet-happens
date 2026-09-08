import { describe, expect, it } from "vitest";

import { createMcpRateLimiter } from "./rate-limit";

/**
 * Every test drives the clock explicitly. A limiter tested against the real clock either sleeps or
 * asserts nothing about the window's edges, and the edges are the whole behaviour.
 */
describe("createMcpRateLimiter", () => {
  it("allows up to the limit and then refuses", () => {
    const limiter = createMcpRateLimiter({ windowMs: 1000, max: 3 });

    expect(limiter.check("member-1", 0).allowed).toBe(true);
    expect(limiter.check("member-1", 10).allowed).toBe(true);
    expect(limiter.check("member-1", 20).allowed).toBe(true);
    expect(limiter.check("member-1", 30).allowed).toBe(false);
  });

  /** Keyed by member, so one member's agent cannot spend another's budget. */
  it("keeps one budget per key", () => {
    const limiter = createMcpRateLimiter({ windowMs: 1000, max: 1 });

    expect(limiter.check("member-1", 0).allowed).toBe(true);
    expect(limiter.check("member-1", 1).allowed).toBe(false);
    expect(limiter.check("member-2", 1).allowed).toBe(true);
  });

  it("lets the window slide rather than resetting on a fixed boundary", () => {
    const limiter = createMcpRateLimiter({ windowMs: 1000, max: 2 });

    limiter.check("member-1", 0);
    limiter.check("member-1", 900);

    expect(limiter.check("member-1", 950).allowed).toBe(false);

    // The first hit has aged out at 1001, so there is room for exactly one more.
    expect(limiter.check("member-1", 1001).allowed).toBe(true);
    expect(limiter.check("member-1", 1002).allowed).toBe(false);
  });

  /**
   * `Retry-After` is derived from the oldest hit still inside the window — the true wait rather than
   * a flat guess — and is never 0, which would invite an immediate retry that fails again.
   */
  it("reports how long until there is room", () => {
    const limiter = createMcpRateLimiter({ windowMs: 60_000, max: 1 });

    limiter.check("member-1", 0);
    const refused = limiter.check("member-1", 30_000);

    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.retryAfterSeconds).toBe(30);
    }
  });

  it("never reports a zero retry", () => {
    const limiter = createMcpRateLimiter({ windowMs: 1000, max: 1 });

    limiter.check("member-1", 0);
    const refused = limiter.check("member-1", 999);

    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });

  /** A refusal must not itself count as a hit, or a blocked caller could never recover. */
  it("does not extend the window by being refused", () => {
    const limiter = createMcpRateLimiter({ windowMs: 1000, max: 1 });

    limiter.check("member-1", 0);
    limiter.check("member-1", 500);
    limiter.check("member-1", 900);

    expect(limiter.check("member-1", 1001).allowed).toBe(true);
  });

  it("forgets keys whose window has fully aged out", () => {
    const limiter = createMcpRateLimiter({ windowMs: 10, max: 1 });

    for (let index = 0; index < 1200; index += 1) {
      limiter.check(`member-${index}`, index);
    }

    // The sweep runs on the allowed path, so an early key's budget is free again rather than
    // remembered forever.
    expect(limiter.check("member-0", 5000).allowed).toBe(true);
  });

  it("clears everything on reset", () => {
    const limiter = createMcpRateLimiter({ windowMs: 1000, max: 1 });

    limiter.check("member-1", 0);
    limiter.reset();

    expect(limiter.check("member-1", 1).allowed).toBe(true);
  });
});
