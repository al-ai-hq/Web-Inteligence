import { describe, it, expect } from "vitest";
import { checkDraftRate } from "../src/draft-rate.js";

describe("checkDraftRate", () => {
  it("allows drafts under the limit", () => {
    const result = checkDraftRate("project-1", new Date("2026-10-01"), 5);
    expect(result.ok).toBe(true);
  });

  it("allows exactly 7 drafts (one below limit)", () => {
    const result = checkDraftRate("project-1", new Date("2026-10-01"), 7);
    expect(result.ok).toBe(true);
  });

  it("rejects when limit reached (8 drafts)", () => {
    const result = checkDraftRate("project-1", new Date("2026-10-01"), 8);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("8 drafts");
  });

  it("rejects when over limit", () => {
    const result = checkDraftRate("project-1", new Date("2026-10-01"), 10);
    expect(result.ok).toBe(false);
  });
});
