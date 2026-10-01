import { describe, it, expect, beforeEach } from "vitest";
import { CostTracker } from "../../src/providers/cost-tracker.js";

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker({
      monthlyHardCap: 150.0,
      paidStopAt: 140.0,
      perAuditSoftCap: 3.0,
      perAuditHardCap: 4.0,
    });
  });

  it("records a cost entry", () => {
    tracker.record({
      audit_id: "audit-1",
      agent_name: "auditor",
      model: "gemini-2.0-flash",
      tokens_in: 1000,
      tokens_out: 500,
      usd: 0.001,
    });
    expect(tracker.getAuditCost("audit-1").total_usd).toBeCloseTo(0.001);
  });

  it("accumulates costs per audit", () => {
    tracker.record({ audit_id: "audit-1", agent_name: "auditor", model: "gemini-2.0-flash", tokens_in: 100, tokens_out: 50, usd: 0.001 });
    tracker.record({ audit_id: "audit-1", agent_name: "auditor", model: "gemini-2.0-flash", tokens_in: 200, tokens_out: 100, usd: 0.002 });
    expect(tracker.getAuditCost("audit-1").total_usd).toBeCloseTo(0.003);
  });

  it("tracks monthly total across audits", () => {
    tracker.record({ audit_id: "audit-1", agent_name: "auditor", model: "gemini-2.0-flash", tokens_in: 100, tokens_out: 50, usd: 1.0 });
    tracker.record({ audit_id: "audit-2", agent_name: "auditor", model: "gemini-2.0-flash", tokens_in: 100, tokens_out: 50, usd: 2.0 });
    expect(tracker.getMonthlyTotal()).toBeCloseTo(3.0);
  });

  it("allows calls when under all caps", () => {
    expect(tracker.canProceed("audit-1")).toBe(true);
  });

  it("blocks calls when monthly paid-stop reached", () => {
    tracker.record({ audit_id: "audit-1", agent_name: "auditor", model: "gemini-2.0-flash", tokens_in: 0, tokens_out: 0, usd: 140.0 });
    expect(tracker.canProceed("audit-2")).toBe(false);
  });

  it("blocks calls when per-audit hard cap reached", () => {
    tracker.record({ audit_id: "audit-1", agent_name: "auditor", model: "gemini-2.0-flash", tokens_in: 0, tokens_out: 0, usd: 4.0 });
    expect(tracker.canProceed("audit-1")).toBe(false);
  });

  it("returns soft_cap_reached when per-audit soft cap exceeded", () => {
    tracker.record({ audit_id: "audit-1", agent_name: "auditor", model: "gemini-2.0-flash", tokens_in: 0, tokens_out: 0, usd: 3.5 });
    const status = tracker.canProceed("audit-1");
    expect(status).toBe(true);
    expect(tracker.getAuditCost("audit-1").soft_cap_reached).toBe(true);
  });
});
