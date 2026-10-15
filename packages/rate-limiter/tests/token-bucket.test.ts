import { describe, expect, it } from "vitest";
import { TokenBucket } from "../src/token-bucket.js";

const HOUR_MS = 60 * 60 * 1000;

describe("TokenBucket", () => {
  it("allows requests while tokens remain", () => {
    const bucket = new TokenBucket({ capacity: 5, refillRateMs: HOUR_MS });
    expect(bucket.consume(1, new Date(0))).toBe(true);
    expect(bucket.consume(1, new Date(0))).toBe(true);
    expect(bucket.consume(3, new Date(0))).toBe(true);
    expect(bucket.consume(1, new Date(0))).toBe(false);
  });

  it("refills tokens after the refill interval", () => {
    const bucket = new TokenBucket({ capacity: 5, refillRateMs: HOUR_MS });
    expect(bucket.consume(5, new Date(0))).toBe(true);
    expect(bucket.consume(1, new Date(HOUR_MS))).toBe(true);
  });

  it("reports remaining and reset time", () => {
    const bucket = new TokenBucket({ capacity: 5, refillRateMs: HOUR_MS });
    bucket.consume(2, new Date(0));
    const state = bucket.state(new Date(0));
    expect(state.remaining).toBe(3);
    expect(state.resetAt.getTime()).toBe(HOUR_MS);
  });

  it("does not accumulate beyond capacity", () => {
    const bucket = new TokenBucket({ capacity: 5, refillRateMs: HOUR_MS });
    bucket.consume(5, new Date(0));
    expect(bucket.consume(1, new Date(3 * HOUR_MS))).toBe(true);
    expect(bucket.consume(5, new Date(3 * HOUR_MS))).toBe(false);
  });
});
