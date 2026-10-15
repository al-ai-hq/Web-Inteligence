import { TokenBucket } from "./token-bucket.js";
import type { RateLimitResult, RateLimiter } from "./types.js";

export const ANONYMOUS_CAPACITY = 5;
export const ANONYMOUS_REFILL_MS = 60 * 60 * 1000;
export const USER_CAPACITY = 50;
export const SUSPICIOUS_THRESHOLD = 3;
export const SUSPICIOUS_WINDOW_MS = 10 * 60 * 1000;
export const SUSPICIOUS_DURATION_MS = 60 * 60 * 1000;

interface FailureWindow {
  failures: number;
  windowStart: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly anonymous = new Map<string, TokenBucket>();
  private readonly users = new Map<string, TokenBucket>();
  private readonly failures = new Map<string, FailureWindow>();
  private readonly suspiciousUntil = new Map<string, number>();

  async checkAnonymous(ip: string, now: Date = new Date()): Promise<RateLimitResult> {
    let bucket = this.anonymous.get(ip);
    if (!bucket) {
      bucket = new TokenBucket({ capacity: ANONYMOUS_CAPACITY, refillRateMs: ANONYMOUS_REFILL_MS });
      this.anonymous.set(ip, bucket);
    }
    const allowed = bucket.consume(1, now);
    const state = bucket.state(now);
    return {
      allowed,
      limit: ANONYMOUS_CAPACITY,
      remaining: state.remaining,
      resetAt: state.resetAt,
    };
  }

  async checkUser(
    userId: string,
    projectId: string,
    now: Date = new Date(),
  ): Promise<RateLimitResult> {
    const key = `user:${userId}:project:${projectId}`;
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const keyWithMonth = `${key}:month:${monthStart.toISOString()}`;

    let bucket = this.users.get(keyWithMonth);
    if (!bucket) {
      bucket = new TokenBucket({
        capacity: USER_CAPACITY,
        refillRateMs: Number.POSITIVE_INFINITY,
      });
      this.users.set(keyWithMonth, bucket);
    }

    const allowed = bucket.consume(1, now);
    const state = bucket.state(now);
    return {
      allowed,
      limit: USER_CAPACITY,
      remaining: state.remaining,
      resetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
    };
  }

  async anonymousState(ip: string, now: Date = new Date()): Promise<RateLimitResult> {
    let bucket = this.anonymous.get(ip);
    if (!bucket) {
      bucket = new TokenBucket({ capacity: ANONYMOUS_CAPACITY, refillRateMs: ANONYMOUS_REFILL_MS });
      this.anonymous.set(ip, bucket);
    }
    const state = bucket.state(now);
    return {
      allowed: state.remaining > 0,
      limit: ANONYMOUS_CAPACITY,
      remaining: state.remaining,
      resetAt: state.resetAt,
    };
  }

  async userState(
    userId: string,
    projectId: string,
    now: Date = new Date(),
  ): Promise<RateLimitResult> {
    const key = `user:${userId}:project:${projectId}`;
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const keyWithMonth = `${key}:month:${monthStart.toISOString()}`;

    let bucket = this.users.get(keyWithMonth);
    if (!bucket) {
      bucket = new TokenBucket({
        capacity: USER_CAPACITY,
        refillRateMs: Number.POSITIVE_INFINITY,
      });
      this.users.set(keyWithMonth, bucket);
    }

    const state = bucket.state(now);
    return {
      allowed: state.remaining > 0,
      limit: USER_CAPACITY,
      remaining: state.remaining,
      resetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
    };
  }

  async recordFailure(ip: string, now: Date = new Date()): Promise<void> {
    const nowMs = now.getTime();
    const current = this.failures.get(ip);
    if (!current || nowMs - current.windowStart >= SUSPICIOUS_WINDOW_MS) {
      this.failures.set(ip, { failures: 1, windowStart: nowMs });
      return;
    }
    current.failures += 1;
    if (current.failures >= SUSPICIOUS_THRESHOLD) {
      this.suspiciousUntil.set(ip, nowMs + SUSPICIOUS_DURATION_MS);
    }
  }

  async isSuspicious(ip: string, now: Date = new Date()): Promise<boolean> {
    const until = this.suspiciousUntil.get(ip);
    if (!until) {
      return false;
    }
    if (now.getTime() >= until) {
      this.suspiciousUntil.delete(ip);
      return false;
    }
    return true;
  }
}
