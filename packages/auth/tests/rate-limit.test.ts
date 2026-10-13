import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/rate-limit.js";

const NOW = 1_000_000;
const MINUTE = 60 * 1000;

describe("RateLimiter", () => {
  it("blocks after maxFailures", () => {
    const limiter = new RateLimiter({ maxFailures: 3, windowMs: 15 * MINUTE });
    limiter.recordFailure("key", NOW);
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW)).toBe(false);
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW)).toBe(true);
  });

  it("unblocks after window elapses", () => {
    const limiter = new RateLimiter({ maxFailures: 3, windowMs: 15 * MINUTE });
    limiter.recordFailure("key", NOW);
    limiter.recordFailure("key", NOW);
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW + 15 * MINUTE)).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter({ maxFailures: 1, windowMs: 15 * MINUTE });
    limiter.recordFailure("a", NOW);
    expect(limiter.isBlocked("a", NOW)).toBe(true);
    expect(limiter.isBlocked("b", NOW)).toBe(false);
  });

  it("resets a key", () => {
    const limiter = new RateLimiter({ maxFailures: 1, windowMs: 15 * MINUTE });
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW)).toBe(true);
    limiter.reset("key");
    expect(limiter.isBlocked("key", NOW)).toBe(false);
  });

  it("defaults to 10 failures / 15 minutes", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure("key", NOW);
    }
    expect(limiter.isBlocked("key", NOW)).toBe(false);
    limiter.recordFailure("key", NOW);
    expect(limiter.isBlocked("key", NOW)).toBe(true);
  });
});
