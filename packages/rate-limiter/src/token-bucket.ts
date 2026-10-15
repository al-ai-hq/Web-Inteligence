export interface TokenBucketState {
  remaining: number;
  resetAt: Date;
}

export interface TokenBucketOptions {
  capacity: number;
  refillRateMs: number;
}

export class TokenBucket {
  private readonly capacity: number;
  private readonly refillRateMs: number;
  private tokens: number;
  private lastRefillAt: number;

  constructor(options: TokenBucketOptions) {
    this.capacity = options.capacity;
    this.refillRateMs = options.refillRateMs;
    this.tokens = options.capacity;
    this.lastRefillAt = 0;
  }

  private refill(nowMs: number): void {
    if (nowMs < this.lastRefillAt) {
      return;
    }
    const elapsed = nowMs - this.lastRefillAt;
    const refills = Math.floor(elapsed / this.refillRateMs);
    if (refills > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + refills * this.capacity);
      this.lastRefillAt += refills * this.refillRateMs;
    }
  }

  consume(amount: number, now: Date = new Date()): boolean {
    const nowMs = now.getTime();
    this.refill(nowMs);
    if (this.tokens < amount) {
      return false;
    }
    this.tokens -= amount;
    return true;
  }

  state(now: Date = new Date()): TokenBucketState {
    const nowMs = now.getTime();
    this.refill(nowMs);
    let resetAtMs = this.lastRefillAt + this.refillRateMs;
    if (resetAtMs <= nowMs) {
      resetAtMs = nowMs + this.refillRateMs;
    }
    return {
      remaining: Math.max(0, this.tokens),
      resetAt: new Date(resetAtMs),
    };
  }
}
