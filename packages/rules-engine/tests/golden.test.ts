/**
 * Golden fixture tests — lock in the engine's end-to-end behavior.
 *
 * Given a known evidence bundle (synthetic-evidence.json), the engine must
 * produce exactly the expected score, findings, and integrity results
 * (expected-results.json).
 *
 * These tests verify:
 * 1. Exact Presence Readiness score reproduction
 * 2. Category scores match
 * 3. Applied caps match
 * 4. Content hash determinism + change detection (integrity)
 * 5. All 77 rules evaluate
 * 6. Findings match
 */
import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence } from "../src/evidence.js";
import { loadConfig } from "../src/config-loader.js";
import { RuleCatalog } from "../src/rule-catalog.js";
import { runRulesEngine } from "../src/engine.js";
import { aggregateToSite, clusterPagesByTemplate, findTemplateFailures } from "../src/aggregate.js";
import { calculateScore } from "../src/scoring.js";
import { generateFindings } from "../src/findings.js";
import { computeContentHash } from "../src/integrity.js";
import syntheticPages from "./golden/synthetic-evidence.json" with { type: "json" };
import expectedResults from "./golden/expected-results.json" with { type: "json" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBundle(pages: PageEvidence[]): EvidenceBundle {
  return {
    methodology_version: "0.1.0-draft",
    tier: "rich",
    locale: "en",
    site: {
      root_url: "https://example.com",
      homepage: pages[0] ?? null,
      robots: {
        fetched: true,
        content: "User-agent: *\nAllow: /\n",
        directives: [{ user_agent: "*", allow: ["/"], disallow: [] }],
      },
      sitemap: { present: true, url_count: 10 },
      llms_txt: null,
      security: { https_valid: true, hsts: true },
    },
    pages,
    connectors: {},
  };
}

function runFullPipeline(pages: PageEvidence[]) {
  const { rules, scoring } = loadConfig();
  const catalog = new RuleCatalog(rules);
  const bundle = buildBundle(pages);

  const pageResults = runRulesEngine(bundle, catalog);
  const siteResults = aggregateToSite(pageResults, bundle);
  const clusters = clusterPagesByTemplate(bundle.pages);
  const templateResults = findTemplateFailures(pageResults, clusters, bundle);
  const allResults = [...siteResults, ...templateResults];

  const context = {
    pages_inspected: pages.length,
    homepage_inspected: true,
    critical_stages_completed: ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING"],
  };

  const score = calculateScore(allResults, rules, scoring, context);
  const findings = generateFindings(siteResults, rules);

  return { score, findings, pageResults, siteResults, templateResults, allResults };
}

// ─── Golden Fixture: Score Reproduction ───────────────────────────────────────

describe("golden fixture — score reproduction", () => {
  const pages = syntheticPages as unknown as PageEvidence[];
  const result = runFullPipeline(pages);

  it("reproduces the exact Presence Readiness score", () => {
    expect(result.score.presence_readiness).toBe(expectedResults.score.presence_readiness);
  });

  it("reproduces the exact pre-cap value", () => {
    expect(result.score.pre_cap_value).toBe(expectedResults.score.pre_cap_value);
  });

  it("reproduces all 7 category scores", () => {
    expect(result.score.categories).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      const actual = result.score.categories[i]!;
      const expected = expectedResults.score.categories[i]!;
      expect(actual.category).toBe(expected.category);
      expect(actual.value).toBe(expected.value);
      expect(actual.measurable_weight).toBe(expected.measurable_weight);
      expect(actual.total_weight).toBe(expected.total_weight);
    }
  });

  it("reproduces applied caps (none expected for this fixture)", () => {
    expect(result.score.applied_caps).toEqual(expectedResults.score.applied_caps);
    expect(result.score.applied_caps).toHaveLength(0);
  });

  it("reproduces coverage", () => {
    expect(result.score.coverage).toBe(expectedResults.score.coverage);
  });

  it("reproduces confidence level", () => {
    expect(result.score.confidence).toBe(expectedResults.score.confidence);
  });

  it("reproduces methodology version", () => {
    expect(result.score.methodology_version).toBe(expectedResults.score.methodology_version);
  });

  it("reproduces unavailable categories", () => {
    expect(result.score.unavailable_categories).toEqual(
      expectedResults.score.unavailable_categories,
    );
  });
});

// ─── Golden Fixture: Findings ─────────────────────────────────────────────────

describe("golden fixture — findings", () => {
  const pages = syntheticPages as unknown as PageEvidence[];
  const result = runFullPipeline(pages);

  it("produces the expected number of findings", () => {
    expect(result.findings.length).toBe(expectedResults.findings.length);
  });

  it("reproduces finding rule_ids and severities", () => {
    for (let i = 0; i < expectedResults.findings.length; i++) {
      const actual = result.findings[i]!;
      const expected = expectedResults.findings[i]!;
      expect(actual.rule_id).toBe(expected.rule_id);
      expect(actual.severity).toBe(expected.severity);
      expect(actual.category).toBe(expected.category);
      expect(actual.evidence_state).toBe(expected.evidence_state);
    }
  });

  it("reproduces finding evidence_ids", () => {
    for (let i = 0; i < expectedResults.findings.length; i++) {
      const actual = result.findings[i]!;
      const expected = expectedResults.findings[i]!;
      expect(actual.evidence_ids).toEqual(expected.evidence_ids);
    }
  });
});

// ─── Golden Fixture: Rule Coverage ────────────────────────────────────────────

describe("golden fixture — rule evaluation coverage", () => {
  const pages = syntheticPages as unknown as PageEvidence[];
  const result = runFullPipeline(pages);

  it("evaluates all 77 rules", () => {
    const uniqueRuleIds = new Set(result.allResults.map((r) => r.rule_id));
    expect(uniqueRuleIds.size).toBe(77);
  });

  it("evaluates at least 70 rules (minimum threshold)", () => {
    const uniqueRuleIds = new Set(result.allResults.map((r) => r.rule_id));
    expect(uniqueRuleIds.size).toBeGreaterThanOrEqual(70);
  });

  it("produces the expected total page-level results", () => {
    expect(result.pageResults.length).toBe(expectedResults.meta.total_page_results);
  });

  it("produces the expected site-level results", () => {
    expect(result.siteResults.length).toBe(expectedResults.meta.total_site_results);
  });
});

// ─── Integrity: Content Hash Determinism + Change Detection ───────────────────

describe("golden fixture — integrity", () => {
  it("computeContentHash produces deterministic output for same input", () => {
    const evidenceIds = ["page-homepage", "page-blog-noindex", "page-about-mixed"];
    const version = "0.1.0-draft";

    const hash1 = computeContentHash(evidenceIds, version);
    const hash2 = computeContentHash(evidenceIds, version);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("computeContentHash produces different output for different input", () => {
    const version = "0.1.0-draft";
    const hash1 = computeContentHash(["page-homepage", "page-blog-noindex"], version);
    const hash2 = computeContentHash(["page-homepage", "page-about-mixed"], version);

    expect(hash1).not.toBe(hash2);
  });

  it("computeContentHash is order-independent", () => {
    const version = "0.1.0-draft";
    const hash1 = computeContentHash(
      ["page-about-mixed", "page-homepage", "page-blog-noindex"],
      version,
    );
    const hash2 = computeContentHash(
      ["page-homepage", "page-blog-noindex", "page-about-mixed"],
      version,
    );

    expect(hash1).toBe(hash2);
  });

  it("computeContentHash changes when methodology version changes", () => {
    const evidenceIds = ["page-homepage"];
    const hash1 = computeContentHash(evidenceIds, "0.1.0-draft");
    const hash2 = computeContentHash(evidenceIds, "0.2.0");

    expect(hash1).not.toBe(hash2);
  });

  it("synthetic evidence has valid content_hash format for all pages", () => {
    const pages = syntheticPages as unknown as PageEvidence[];
    const validHashRe = /^sha256:[0-9a-f]{64}$/;

    for (const page of pages) {
      expect(page.content_hash).toMatch(validHashRe);
    }
  });
});
