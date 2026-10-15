import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chdir, cwd } from "node:process";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { ExperienceReviewerAgent } from "../../../core/src/agents/experience-reviewer.js";
import { composeSections } from "../../src/composer.js";
import { TIER_SCOPES } from "../../src/eligibility.js";
import type { ComposerAgentOutcome, ComposerFinding } from "../../src/report-envelope.js";
import type { ExperienceEvidencePackage } from "../../../core/src/types/experience-evidence.js";

// The experience-reviewer agent loads config/experience-effectiveness.yaml
// relative to process.cwd(). When running from the package directory, we need
// to chdir to the repo root so the config file is found.
let originalCwd: string;

beforeAll(() => {
  originalCwd = cwd();
  // If config already accessible from cwd, no need to change
  if (existsSync(join(originalCwd, "config", "experience-effectiveness.yaml"))) {
    return;
  }
  // Walk up from cwd to find the repo root
  let dir = originalCwd;
  for (let i = 0; i < 10; i++) {
    dir = resolve(dir, "..");
    if (existsSync(join(dir, "config", "experience-effectiveness.yaml"))) {
      chdir(dir);
      return;
    }
  }
});

afterAll(() => {
  chdir(originalCwd);
});

/**
 * Map agent-internal findings (id, result_state: 'pass') to ComposerFinding shape
 * (finding_id, result_state in the verified|inferred|not_verified|unavailable union).
 */
function toComposerFindings(
  agentFindings: Array<{
    id: string;
    result_state: string;
    confidence: string;
    evidence_ids: string[];
    data: Record<string, unknown>;
  }>,
): ComposerFinding[] {
  return agentFindings.map((f) => ({
    finding_id: f.id,
    result_state: (f.result_state === "pass"
      ? "verified"
      : f.result_state) as ComposerFinding["result_state"],
    confidence: f.confidence as ComposerFinding["confidence"],
    evidence_ids: [...f.evidence_ids],
    data: { ...f.data },
    limitations: [],
  }));
}

function buildEvidence(): ExperienceEvidencePackage {
  return {
    page_url: "https://example.com",
    language: "en",
    market: "US",
    screenshots: {
      viewport: "evidence_viewport_001",
      full_page: "evidence_fullpage_001",
      above_fold: "evidence_abovefold_001",
    },
    extractor_results: {
      heading: { title: "Test", h1_count: 1, hierarchy: [] },
      form: { forms: [], fields: [] },
      contact: { emails: [], phones: [], addresses: [] },
      policy: { privacy: null, terms: null, cookies: null },
      language: { detected: "en", confidence: "high" },
      analytics: { has_analytics: true, providers: ["ga4"] },
      viewport: { has_viewport_meta: true, responsive: true },
      wayfinding: { nav_items: [], breadcrumbs: [] },
    },
    readiness_results: {
      score: 75,
      categories: [],
      confidence: "high",
    },
  };
}

describe("Experience Effectiveness - End-to-End", () => {
  it("should run full pipeline and produce Experience section", async () => {
    const evidence = buildEvidence();

    // Step 1: Run the experience-reviewer agent
    const agent = new ExperienceReviewerAgent();
    const agentResult = await agent.execute(evidence);

    // Step 2: Map agent output to ComposerAgentOutcome shape
    const composerOutcome: ComposerAgentOutcome = {
      agent_name: "experience-reviewer",
      ok: true,
      findings: toComposerFindings(agentResult.findings),
      limitations: [],
      data: agentResult.data as Record<string, unknown>,
    };

    // Step 3: Run the composer
    const composeResult = composeSections([composerOutcome], [], TIER_SCOPES.rich);

    // Validate experience_score is present and in valid range
    expect(composeResult.experience_score).toBeDefined();
    expect(composeResult.experience_score?.experience_effectiveness).toBeGreaterThanOrEqual(0);
    expect(composeResult.experience_score?.experience_effectiveness).toBeLessThanOrEqual(100);
    expect(composeResult.experience_score?.fidelity_label).toBe("assessed");

    // Validate experience findings exist
    const experienceFindings = composeResult.findings.filter((f) => f.section === "experience");
    expect(experienceFindings.length).toBeGreaterThan(0);

    // Validate reviewer trace on every experience finding
    for (const finding of experienceFindings) {
      expect(finding.data.reviewer_trace).toBeDefined();
      expect((finding.data.reviewer_trace as Record<string, unknown>).rubric_version).toBe(
        "0.1.0-draft",
      );
    }
  });

  it("should maintain D-012 separation from Presence Readiness", async () => {
    const evidence = buildEvidence();

    const agent = new ExperienceReviewerAgent();
    const agentResult = await agent.execute(evidence);

    const composerOutcome: ComposerAgentOutcome = {
      agent_name: "experience-reviewer",
      ok: true,
      findings: toComposerFindings(agentResult.findings),
      limitations: [],
      data: agentResult.data as Record<string, unknown>,
    };

    const composeResult = composeSections([composerOutcome], [], TIER_SCOPES.rich);

    // D-012: Presence Readiness score must remain null (no rules engine output)
    expect(composeResult.score).toBeNull();
    // Experience score must be populated
    expect(composeResult.experience_score).not.toBeNull();

    // All experience findings must be attributed to experience-reviewer
    const experienceFindings = composeResult.findings.filter((f) => f.section === "experience");
    const technicalFindings = composeResult.findings.filter((f) => f.section === "technical");

    for (const finding of experienceFindings) {
      expect(finding.agent).toBe("experience-reviewer");
    }

    // No experience-reviewer findings should leak into technical section
    for (const finding of technicalFindings) {
      expect(finding.agent).not.toBe("experience-reviewer");
    }
  });
});
