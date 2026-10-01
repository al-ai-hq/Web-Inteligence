type State = "closed" | "open" | "half-open";

const OPEN_AFTER_FAILURES = 3;
const COOLDOWN_MS = 15 * 60 * 1000;

export class CircuitBreaker {
  private state: State = "closed";
  private consecutiveFailures = 0;
  private openedAt = 0;

  isAvailable(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.openedAt >= COOLDOWN_MS) {
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
    if (this.consecutiveFailures >= OPEN_AFTER_FAILURES) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}
