import { describe, expect, it } from "vitest";
import {
  InMemoryRateLimiter,
  TokenBucket,
  verifyTurnstileToken,
  type RateLimitResult,
} from "../src/index.js";

describe("@wpi/rate-limiter public API", () => {
  it("exports InMemoryRateLimiter", () => {
    const limiter = new InMemoryRateLimiter();
    expect(limiter).toBeDefined();
  });

  it("exports TokenBucket", () => {
    const bucket = new TokenBucket({ capacity: 5, refillRateMs: 60 * 60 * 1000 });
    expect(bucket.consume(1)).toBe(true);
  });

  it("exports verifyTurnstileToken", () => {
    expect(typeof verifyTurnstileToken).toBe("function");
  });

  it("RateLimitResult has the expected shape", () => {
    const result: RateLimitResult = {
      allowed: true,
      limit: 5,
      remaining: 3,
      resetAt: new Date(),
    };
    expect(result.remaining).toBe(3);
  });
});
