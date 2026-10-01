import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker } from "../../src/providers/circuit-breaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in closed state (available)", () => {
    const cb = new CircuitBreaker();
    expect(cb.isAvailable()).toBe(true);
  });

  it("opens after 3 consecutive failures", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isAvailable()).toBe(true);
    cb.recordFailure();
    expect(cb.isAvailable()).toBe(false);
  });

  it("resets failure count on success", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    expect(cb.isAvailable()).toBe(true);
  });

  it("transitions to half-open after cooldown (15 minutes)", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isAvailable()).toBe(false);

    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(cb.isAvailable()).toBe(true);
  });

  it("half-open allows one probe: success closes breaker", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();

    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(cb.isAvailable()).toBe(true);

    cb.recordSuccess();
    expect(cb.isAvailable()).toBe(true);
  });

  it("half-open probe failure re-opens breaker", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();

    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(cb.isAvailable()).toBe(true);

    cb.recordFailure();
    expect(cb.isAvailable()).toBe(false);
  });
});
