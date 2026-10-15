import type { RateLimiter, RateLimitResult } from "./types.js";

export class InMemoryRateLimiter implements RateLimiter {
  async checkAnonymous(_ip: string, _now?: Date): Promise<RateLimitResult> {
    return {
      allowed: true,
      limit: 5,
      remaining: 5,
      resetAt: new Date(),
    };
  }

  async checkUser(
    _userId: string,
    _projectId: string,
    _now?: Date,
  ): Promise<RateLimitResult> {
    return {
      allowed: true,
      limit: 50,
      remaining: 50,
      resetAt: new Date(),
    };
  }

  async recordFailure(_ip: string, _now?: Date): Promise<void> {
    // placeholder for pilot failure tracking
  }

  async isSuspicious(_ip: string, _now?: Date): Promise<boolean> {
    return false;
  }
}
