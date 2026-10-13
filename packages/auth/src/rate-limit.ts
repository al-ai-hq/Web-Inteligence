export interface RateLimitOptions {
  maxFailures: number;
  windowMs: number;
}

interface WindowState {
  failures: number;
  windowStart: number;
}

export const RATE_LIMIT_MAX_FAILURES = 10;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export class RateLimiter {
  private readonly windows = new Map<string, WindowState>();
  private readonly maxFailures: number;
  private readonly windowMs: number;

  constructor(options: Partial<RateLimitOptions> = {}) {
    this.maxFailures = options.maxFailures ?? RATE_LIMIT_MAX_FAILURES;
    this.windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  }

  isBlocked(key: string, now: number = Date.now()): boolean {
    const state = this.windows.get(key);
    if (!state) {
      return false;
    }
    if (now - state.windowStart >= this.windowMs) {
      this.windows.delete(key);
      return false;
    }
    return state.failures >= this.maxFailures;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const state = this.windows.get(key);
    if (!state || now - state.windowStart >= this.windowMs) {
      this.windows.set(key, { failures: 1, windowStart: now });
      return;
    }
    state.failures += 1;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }
}
