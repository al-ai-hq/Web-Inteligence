import { describe, it, expect } from "vitest";
import { isApprovalExpired } from "../src/approval-expiry.js";

describe("isApprovalExpired", () => {
  it("returns false when approval is within expiry window", () => {
    const approvedAt = new Date("2026-10-10T10:00:00Z");
    const now = new Date("2026-10-12T10:00:00Z");
    expect(isApprovalExpired(approvedAt, now, 7)).toBe(false);
  });

  it("returns true when approval has expired", () => {
    const approvedAt = new Date("2026-10-01T10:00:00Z");
    const now = new Date("2026-10-10T10:00:00Z");
    expect(isApprovalExpired(approvedAt, now, 7)).toBe(true);
  });
});
