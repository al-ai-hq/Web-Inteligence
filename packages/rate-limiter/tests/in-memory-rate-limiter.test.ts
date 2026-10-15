import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "../src/in-memory-rate-limiter.js";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe("InMemoryRateLimiter", () => {
  it("allows 5 anonymous requests then blocks the 6th in the same hour", async () => {
    const limiter = new InMemoryRateLimiter();
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) {
      const result = await limiter.checkAnonymous(ip, new Date(0));
      expect(result.allowed).toBe(true);
    }
    const blocked = await limiter.checkAnonymous(ip, new Date(0));
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(5);
    expect(blocked.remaining).toBe(0);
  });

  it("refills the anonymous bucket after one hour", async () => {
    const limiter = new InMemoryRateLimiter();
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) {
      await limiter.checkAnonymous(ip, new Date(0));
    }
    const result = await limiter.checkAnonymous(ip, new Date(HOUR_MS));
    expect(result.allowed).toBe(true);
  });

  it("tracks different IPs independently", async () => {
    const limiter = new InMemoryRateLimiter();
    await limiter.checkAnonymous("1.2.3.4", new Date(0));
    const other = await limiter.checkAnonymous("5.6.7.8", new Date(0));
    expect(other.remaining).toBe(4);
  });

  it("allows 50 signed-in requests per calendar month", async () => {
    const limiter = new InMemoryRateLimiter();
    const userId = "user-1";
    const projectId = "project-1";
    for (let i = 0; i < 50; i++) {
      const result = await limiter.checkUser(userId, projectId, new Date("2026-10-01T00:00:00Z"));
      expect(result.allowed).toBe(true);
    }
    const blocked = await limiter.checkUser(userId, projectId, new Date("2026-10-15T00:00:00Z"));
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets the user quota at the start of a new month", async () => {
    const limiter = new InMemoryRateLimiter();
    const userId = "user-1";
    const projectId = "project-1";
    for (let i = 0; i < 50; i++) {
      await limiter.checkUser(userId, projectId, new Date("2026-10-31T23:59:00Z"));
    }
    const nextMonth = await limiter.checkUser(userId, projectId, new Date("2026-11-01T00:00:01Z"));
    expect(nextMonth.allowed).toBe(true);
    expect(nextMonth.remaining).toBe(49);
  });

  it("marks an IP suspicious after 3 failures", async () => {
    const limiter = new InMemoryRateLimiter();
    const ip = "1.2.3.4";
    expect(await limiter.isSuspicious(ip, new Date(0))).toBe(false);
    await limiter.recordFailure(ip, new Date(0));
    await limiter.recordFailure(ip, new Date(0));
    await limiter.recordFailure(ip, new Date(0));
    expect(await limiter.isSuspicious(ip, new Date(0))).toBe(true);
  });

  it("keeps an IP suspicious for one hour", async () => {
    const limiter = new InMemoryRateLimiter();
    const ip = "1.2.3.4";
    await limiter.recordFailure(ip, new Date(0));
    await limiter.recordFailure(ip, new Date(0));
    await limiter.recordFailure(ip, new Date(0));
    expect(await limiter.isSuspicious(ip, new Date(59 * MINUTE_MS))).toBe(true);
    expect(await limiter.isSuspicious(ip, new Date(61 * MINUTE_MS))).toBe(false);
  });
});
