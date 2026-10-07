import { describe, expect, it } from "vitest";
import {
  composeSections,
  deriveActionItems,
  deriveSeverity,
  deriveUnavailable,
} from "../src/composer.js";
import type { ComposerAgentOutcome, StoredFinding } from "../src/report-envelope.js";
import { TIER_SCOPES } from "../src/eligibility.js";

function finding(overrides: Partial<StoredFinding> = {}): StoredFinding {
  return {
    id: "f1",
    agent: "auditor",
    section: "technical",
    severity: "high",
    state: "verified",
    confidence: "high",
    evidence_ids: ["ev1"],
    data: {},
    ...overrides,
  };
}

function outcome(overrides: Partial<ComposerAgentOutcome> = {}): ComposerAgentOutcome {
  return {
    agent_name: "auditor",
    ok: true,
    findings: [],
    limitations: [],
    ...overrides,
  };
}

describe("deriveSeverity", () => {
  it("maps a valid severity value from finding data", () => {
    expect(deriveSeverity({ severity: "critical" })).toBe("critical");
  });

  it("defaults to info for missing or out-of-enum values", () => {
    expect(deriveSeverity({})).toBe("info");
    expect(deriveSeverity({ severity: "ultra" })).toBe("info");
    expect(deriveSeverity({ severity: 3 })).toBe("info");
  });
});

describe("deriveUnavailable", () => {
  it("always reports score and experience/deferred blocks", () => {
    const blocks = deriveUnavailable(TIER_SCOPES.rich);
    const keys = blocks.map((b) => b.reason_key);
    expect(keys).toContain("unavailable.score");
    expect(keys).toContain("unavailable.experience_effectiveness");
    expect(blocks.every((b) => b.section === "technical" || b.section === "comparison" || b.section === "ai_visibility_panel")).toBe(true);
  });

  it("adds comparison for tiers with comparisons > 0 and the panel when enabled", () => {
    const rich = deriveUnavailable(TIER_SCOPES.rich);
    expect(rich.some((b) => b.section === "comparison" && b.reason_key === "unavailable.comparison")).toBe(true);
    expect(rich.some((b) => b.section === "ai_visibility_panel" && b.reason_key === "unavailable.ai_visibility_panel")).toBe(true);
  });

  it("omits comparison and panel for preview", () => {
    const preview = deriveUnavailable(TIER_SCOPES.preview);
    expect(preview.some((b) => b.section === "comparison")).toBe(false);
    expect(preview.some((b) => b.section === "ai_visibility_panel")).toBe(false);
  });
});

describe("deriveActionItems", () => {
  it("keeps only findings with a recommendation and caps the board", () => {
    const findings = [
      finding({ id: "a", data: { title: "T", recommendation: "Do A" }, confidence: "high", severity: "high" }),
      finding({ id: "b", data: { recommendation: "Do B" }, confidence: "low", severity: "low" }),
      finding({ id: "c", data: { title: "No rec" } }),
    ];
    const items = deriveActionItems(findings, 1);
    expect(items).toHaveLength(1);
    expect(items[0]?.source_finding_id).toBe("a");
    expect(items[0]?.title).toBe("T");
    expect(items[0]?.detail).toBe("Do A");
  });

  it("falls back to a truncated recommendation as the title", () => {
    const items = deriveActionItems(
      [finding({ data: { recommendation: "x".repeat(80) } })],
      12,
    );
    expect(items[0]?.title).toBe("x".repeat(60));
  });

  it("sorts by confidence then severity descending", () => {
    const items = deriveActionItems(
      [
        finding({ id: "low", confidence: "low", data: { recommendation: "L" } }),
        finding({ id: "high", confidence: "high", data: { recommendation: "H" } }),
      ],
      12,
    );
    expect(items[0]?.source_finding_id).toBe("high");
  });
});

describe("composeSections", () => {
  it("collects ok outcomes' findings into stored findings and maps cost lines", () => {
    const result = composeSections(
      [
        outcome({
          agent_name: "auditor",
          findings: [
            {
              finding_id: "agent-1",
              result_state: "verified",
              confidence: "high",
              evidence_ids: ["ev-1"],
              data: { title: "T", recommendation: "R", severity: "high" },
              limitations: [],
            },
          ],
          cost: { engine: "gemini-2.0-flash", tokens_in: 10, tokens_out: 5, usd: 0.01 },
        }),
      ],
      [],
      TIER_SCOPES.rich,
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.agent).toBe("auditor");
    expect(result.findings[0]?.section).toBe("technical");
    expect(result.findings[0]?.severity).toBe("high");
    expect(result.findings[0]?.id).not.toBe("agent-1");
    expect(result.costs.total_usd).toBeCloseTo(0.01);
    expect(result.summary_bullets).toContain("report.summary.technical");
  });

  it("skips unavailable findings and non-mapped agents default to technical", () => {
    const result = composeSections(
      [
        outcome({
          agent_name: "auditor",
          findings: [
            {
              finding_id: "u1",
              result_state: "unavailable",
              confidence: "low",
              evidence_ids: [],
              data: {},
              limitations: [],
            },
          ],
        }),
        outcome({ agent_name: "mystery-agent", ok: false, unavailable_reason_key: "unavailable.generic" }),
      ],
      [],
      TIER_SCOPES.preview,
    );
    expect(result.findings).toHaveLength(0);
    expect(result.unavailable).toContainEqual({ section: "technical", reason_key: "unavailable.generic" });
  });

  it("summary bullets only cover sections whose agent succeeded", () => {
    const result = composeSections(
      [
        outcome({ agent_name: "auditor" }),
        outcome({ agent_name: "keyword-analyst", ok: false, unavailable_reason_key: "unavailable.agent.keyword-analyst" }),
        outcome({ agent_name: "content-strategist" }),
      ],
      [],
      TIER_SCOPES.reduced,
    );
    expect(result.summary_bullets).toEqual(["report.summary.technical", "report.summary.content"]);
  });

  it("maps GSC connector to keywords section", () => {
    const result = composeSections(
      [],
      [{ ok: false, connector: "gsc", unavailable_reason_key: "unavailable.connector.gsc" }],
      { comparisons: 0, aiVisibilityPanel: false, maxPages: 1, actionBoardCap: 10 },
    );
    expect(result.unavailable).toContainEqual({
      section: "keywords",
      reason_key: "unavailable.connector.gsc",
    });
  });

  it("maps GA4 connector to performance section", () => {
    const result = composeSections(
      [],
      [{ ok: false, connector: "ga4", unavailable_reason_key: "unavailable.connector.ga4" }],
      { comparisons: 0, aiVisibilityPanel: false, maxPages: 1, actionBoardCap: 10 },
    );
    expect(result.unavailable).toContainEqual({
      section: "performance",
      reason_key: "unavailable.connector.ga4",
    });
  });
});

describe("composeSections - Experience Effectiveness", () => {
  it("should add Experience section when experience-reviewer outcome present", () => {
    const outcomes: ComposerAgentOutcome[] = [
      {
        agent_name: "experience-reviewer",
        ok: true,
        findings: [
          {
            finding_id: "exp_001",
            result_state: "verified",
            confidence: "high",
            evidence_ids: ["screenshot_viewport"],
            data: {
              reviewer_trace: {
                rubric_version: "0.1.0-draft",
                criterion_id: "EXP-DH-01",
                criterion_name: "Visual hierarchy",
                result: "pass",
                confidence: "high",
                rationale: "Clear hierarchy",
                evidence_ids: ["screenshot_viewport"],
                reviewer_type: "model",
                language: "en",
                language_direction: "ltr",
                market: "US",
                evaluated_at: "2026-10-07T12:00:00Z",
                prompt_version: "0.1.0",
                limitations: [],
              },
            },
            limitations: [],
          },
        ],
        limitations: [],
        data: {
          experience_score: {
            experience_effectiveness: 82,
            dimensions: {},
            coverage: 0.95,
            confidence: "high",
            fidelity_label: "assessed",
            methodology_version: "0.1.0-draft",
          },
        },
      },
    ];

    const result = composeSections(outcomes, [], TIER_SCOPES.rich);

    expect(result.experience_score).toBeDefined();
    expect(result.experience_score?.experience_effectiveness).toBe(82);
  });

  it("should add unavailable block when experience-reviewer missing", () => {
    const outcomes: ComposerAgentOutcome[] = [];

    const result = composeSections(outcomes, [], TIER_SCOPES.rich);

    expect(result.unavailable).toContainEqual(
      expect.objectContaining({
        section: "experience",
        reason_key: "unavailable.experience_effectiveness",
      }),
    );
  });
});
