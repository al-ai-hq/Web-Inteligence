type State = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownMs: 15 * 60 * 1000,
};

export class CircuitBreaker {
  private state: State = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  isAvailable(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.openedAt >= this.config.cooldownMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.state === "half-open") {
      this.state = "open";
      this.openedAt = Date.now();
      return;
    }
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}
