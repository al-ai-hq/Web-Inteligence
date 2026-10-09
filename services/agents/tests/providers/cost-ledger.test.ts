import { describe, it, expect, beforeEach } from "vitest";
import { CostLedger } from "../../src/providers/cost-ledger.js";

describe("CostLedger", () => {
  let ledger: CostLedger;

  beforeEach(() => {
    ledger = new CostLedger({
      monthlyHardCap: 150.0,
      paidStopAt: 140.0,
      perAuditSoftCap: 3.0,
      perAuditHardCap: 4.0,
    });
  });

  it("preCallCheck returns allowed when under all caps", () => {
    const result = ledger.preCallCheck("audit-1", 0.01);
    expect(result.decision).toBe("allowed");
    expect(result.month_to_date).toBeCloseTo(0);
  });

  it("preCallCheck returns denied_monthly_cap when monthly total exceeds paidStopAt", () => {
    ledger.postCallRecord({
      audit_id: "audit-1",
      provider: "gemini",
      model_id: "gemini-2.0-flash",
      tokens_in: 0,
      tokens_out: 0,
      amount: 140.0,
      workflow: "prompt_panel",
    });
    const result = ledger.preCallCheck("audit-2", 0.01);
    expect(result.decision).toBe("denied_monthly_cap");
  });

  it("preCallCheck returns denied_audit_hard_cap when audit cost exceeds hard cap", () => {
    ledger.postCallRecord({
      audit_id: "audit-1",
      provider: "gemini",
      model_id: "gemini-2.0-flash",
      tokens_in: 0,
      tokens_out: 0,
      amount: 4.0,
      workflow: "prompt_panel",
    });
    const result = ledger.preCallCheck("audit-1", 0.01);
    expect(result.decision).toBe("denied_audit_hard_cap");
  });

  it("preCallCheck returns allowed_soft_cap_reached when audit exceeds soft cap but not hard cap", () => {
    ledger.postCallRecord({
      audit_id: "audit-1",
      provider: "gemini",
      model_id: "gemini-2.0-flash",
      tokens_in: 0,
      tokens_out: 0,
      amount: 3.5,
      workflow: "prompt_panel",
    });
    const result = ledger.preCallCheck("audit-1", 0.01);
    expect(result.decision).toBe("allowed_soft_cap_reached");
  });

  it("postCallRecord stores entry with source post_call_actual", () => {
    ledger.postCallRecord({
      audit_id: "audit-1",
      provider: "gemini",
      model_id: "gemini-2.0-flash",
      tokens_in: 1000,
      tokens_out: 500,
      amount: 0.001,
      workflow: "prompt_panel",
    });
    expect(ledger.getAuditCost("audit-1").total_usd).toBeCloseTo(0.001);
    expect(ledger.getAuditCost("audit-1").call_count).toBe(1);
  });

  it("getMonthlyTotal sums across audits", () => {
    ledger.postCallRecord({ audit_id: "a1", provider: "gemini", model_id: "m", tokens_in: 0, tokens_out: 0, amount: 1.0, workflow: "prompt_panel" });
    ledger.postCallRecord({ audit_id: "a2", provider: "claude", model_id: "m", tokens_in: 0, tokens_out: 0, amount: 2.0, workflow: "anonymous_audit" });
    expect(ledger.getMonthlyTotal()).toBeCloseTo(3.0);
  });
});
