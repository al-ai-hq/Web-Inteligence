export class TokenBucket {
  private tokens: number;

  constructor(
    private readonly config: {
      capacity: number;
      refillRateMs: number;
    },
  ) {
    this.tokens = config.capacity;
  }

  consume(amount: number): boolean {
    if (amount > this.tokens) {
      return false;
    }
    this.tokens -= amount;
    return true;
  }
}
