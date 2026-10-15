import { describe, it, expect } from "vitest";
import { checkApprovalRequirements } from "../src/risk-tiers.js";

describe("checkApprovalRequirements", () => {
  it("Tier 1 requires one approver", () => {
    const result = checkApprovalRequirements(1, [{ user_id: "user-1", is_requester: false }]);
    expect(result.ok).toBe(true);
  });

  it("Tier 3 requires two approvers", () => {
    const result = checkApprovalRequirements(3, [{ user_id: "user-1", is_requester: false }]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("two approvers");
  });

  it("Tier 3 rejects requester as approver", () => {
    const result = checkApprovalRequirements(3, [
      { user_id: "user-1", is_requester: true },
      { user_id: "user-2", is_requester: false },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("requester");
  });

  it("Tier 3 passes with two non-requester approvers", () => {
    const result = checkApprovalRequirements(3, [
      { user_id: "user-1", is_requester: false },
      { user_id: "user-2", is_requester: false },
    ]);
    expect(result.ok).toBe(true);
  });
});
