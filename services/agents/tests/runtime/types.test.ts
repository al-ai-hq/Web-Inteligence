import { describe, it, expect } from "vitest";
import {
  agentJobSchema,
  agentResultSchema,
  findingSchema,
} from "../../src/runtime/types.js";

describe("runtime types", () => {
  describe("agentJobSchema", () => {
    it("accepts a valid agent job", () => {
      const job = {
        job_id: "job-1",
        audit_id: "audit-1",
        project_id: "proj-1",
        agent_name: "auditor",
        input_evidence_ids: ["ev-1", "ev-2"],
        context: {
          site: "https://example.com",
          market: "US",
          language: "en",
        },
        capture_time: "2026-10-01T00:00:00Z",
      };
      const result = agentJobSchema.safeParse(job);
      expect(result.success).toBe(true);
    });

    it("rejects a job missing required fields", () => {
      const job = { job_id: "job-1" };
      const result = agentJobSchema.safeParse(job);
      expect(result.success).toBe(false);
    });

    it("accepts optional business_goal", () => {
      const job = {
        job_id: "job-1",
        audit_id: "audit-1",
        project_id: "proj-1",
        agent_name: "auditor",
        input_evidence_ids: [],
        context: {
          site: "https://example.com",
          market: "US",
          language: "en",
          business_goal: "Increase organic traffic",
        },
        capture_time: "2026-10-01T00:00:00Z",
      };
      const result = agentJobSchema.safeParse(job);
      expect(result.success).toBe(true);
    });
  });

  describe("findingSchema", () => {
    it("accepts a valid finding", () => {
      const finding = {
        finding_id: "f-1",
        rule_id: "AEO-001",
        page_url: "https://example.com/page",
        result_state: "verified",
        confidence: "high",
        evidence_ids: ["ev-1"],
        data: { score: 0.9 },
        limitations: [],
      };
      const result = findingSchema.safeParse(finding);
      expect(result.success).toBe(true);
    });

    it("rejects invalid result_state", () => {
      const finding = {
        finding_id: "f-1",
        result_state: "invalid_state",
        confidence: "high",
        evidence_ids: [],
        data: {},
        limitations: [],
      };
      const result = findingSchema.safeParse(finding);
      expect(result.success).toBe(false);
    });
  });

  describe("agentResultSchema", () => {
    it("accepts a valid agent result", () => {
      const result = {
        job_id: "job-1",
        agent_name: "auditor",
        audit_id: "audit-1",
        output_evidence_ids: ["ev-out-1"],
        result_state: "verified",
        findings: [],
        limitations: [],
        cost: {
          engine: "gemini",
          tokens_in: 100,
          tokens_out: 50,
          usd: 0.001,
        },
        duration_ms: 1500,
      };
      const parsed = agentResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });
});
