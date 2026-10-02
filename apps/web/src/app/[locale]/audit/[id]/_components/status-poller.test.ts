import { describe, expect, it } from "vitest";
import { isTerminalPollStatus } from "./status-poller";

describe("isTerminalPollStatus", () => {
  it("treats 404 and 410 as terminal", () => {
    expect(isTerminalPollStatus(404)).toBe(true);
    expect(isTerminalPollStatus(410)).toBe(true);
  });

  it("treats success and transient server errors as non-terminal", () => {
    expect(isTerminalPollStatus(200)).toBe(false);
    expect(isTerminalPollStatus(500)).toBe(false);
    expect(isTerminalPollStatus(429)).toBe(false);
  });
});
