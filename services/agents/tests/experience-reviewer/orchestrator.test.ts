import { describe, it, expect, vi } from "vitest";
import { reviewExperience } from "../../src/experience-reviewer/orchestrator.js";
import type { GeminiAdapter } from "../../src/providers/gemini-adapter.js";
import type { CostTracker } from "../../src/providers/cost-tracker.js";
import type { ExperienceEvidencePackage } from "@wpi/core";

function mockAdapter(responses: string[]): GeminiAdapter {
  let callCount = 0;
  return {
    name: "gemini",
    complete: vi.fn().mockImplementation(async () => {
      const response = responses[callCount] ?? responses[0];
      callCount++;
      return {
        content: response,
        usage: { tokens_in: 100, tokens_out: 50 },
        finishReason: "stop",
      };
    }),
    isAvailable: vi.fn().mockReturnValue(true),
  } as any;
}

function mockCostTracker(): CostTracker {
  return {
    record: vi.fn(),
    canProceed: vi.fn().mockReturnValue(true),
    getAuditCost: vi.fn().mockReturnValue({ total_usd: 0, call_count: 0, soft_cap_reached: false }),
    getMonthlyTotal: vi.fn().mockReturnValue(0),
  } as any;
}

const mockEvidence: ExperienceEvidencePackage = {
  page_url: "https://example.com",
  language: "en",
  market: "us",
  screenshots: { viewport: null, full_page: null, above_fold: null },
  extractor_results: {} as any,
  readiness_results: { score: 85, categories: [], confidence: "high" },
};

describe("reviewExperience", () => {
  it("makes 5 dimension calls to Gemini adapter", async () => {
    const validResponse = JSON.stringify({
      criteria: [
        { criterion_id: "EXP-DH-01", result: "pass", confidence: "high", rationale: "Good" },
      ],
    });
    const adapter = mockAdapter([validResponse]);
    const costTracker = mockCostTracker();

    const { findings } = await reviewExperience(mockEvidence, {
      adapter,
      costTracker,
      auditId: "audit-123",
    });

    expect(adapter.complete).toHaveBeenCalledTimes(5);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("records cost for each dimension call", async () => {
    const validResponse = JSON.stringify({
      criteria: [
        { criterion_id: "EXP-DH-01", result: "pass", confidence: "high", rationale: "Good" },
      ],
    });
    const adapter = mockAdapter([validResponse]);
    const costTracker = mockCostTracker();

    await reviewExperience(mockEvidence, {
      adapter,
      costTracker,
      auditId: "audit-123",
    });

    expect(costTracker.record).toHaveBeenCalledTimes(5);
    expect(costTracker.record).toHaveBeenCalledWith(
      expect.objectContaining({
        audit_id: "audit-123",
        agent_name: "experience-reviewer",
      }),
    );
  });

  it("returns experience score with all 5 dimensions", async () => {
    const validResponse = JSON.stringify({
      criteria: [
        { criterion_id: "EXP-DH-01", result: "pass", confidence: "high", rationale: "Good" },
      ],
    });
    const adapter = mockAdapter([validResponse]);
    const costTracker = mockCostTracker();

    const { score } = await reviewExperience(mockEvidence, {
      adapter,
      costTracker,
      auditId: "audit-123",
    });

    expect(score).toBeDefined();
    expect(score.experience_effectiveness).toBeGreaterThanOrEqual(0);
    expect(score.dimensions).toBeDefined();
    expect(score.confidence).toBeDefined();
  });
});
