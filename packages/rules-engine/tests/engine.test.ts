import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence } from "../src/evidence.js";
import type { LoadedRule } from "../src/types.js";
import { RuleCatalog } from "../src/rule-catalog.js";
import { runRulesEngine } from "../src/engine.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePage(overrides: Partial<PageEvidence> = {}): PageEvidence {
  return {
    evidence_id: "page-1",
    url: "https://example.com/",
    final_url: "https://example.com/",
    status_code: 200,
    content_type: "text/html",
    content_hash: "abc123",
    fetched_at: "2026-01-01T00:00:00Z",
    render: { rendered: true },
    title: "Test Page Title That Is Long Enough",
    meta_description: "A test page description that is long enough for SEO",
    canonical: "https://example.com/",
    lang: "en",
    viewport_meta: "width=device-width, initial-scale=1",
    headings: [{ level: 1, text: "Hello World" }],
    word_count: 500,
    main_content_bytes: 3000,
    structured_data: [],
    links: [{ href: "https://example.com/about" }],
    robots_directive: "index",
    ...overrides,
  };
}

function makeBundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    methodology_version: "0.1.0-draft",
    tier: "rich",
    locale: "en",
    site: {
      root_url: "https://example.com",
      homepage: makePage({ evidence_id: "homepage", url: "https://example.com/" }),
      robots: {
        fetched: true,
        content: "User-agent: *\nAllow: /\n",
        directives: [{ user_agent: "*", allow: ["/"], disallow: [] }],
      },
      sitemap: { present: true, url_count: 50 },
      llms_txt: null,
      security: { https_valid: true, hsts: true },
    },
    pages: [
      makePage({ evidence_id: "page-1", url: "https://example.com/" }),
      makePage({ evidence_id: "page-2", url: "https://example.com/about" }),
    ],
    connectors: {},
    ...overrides,
  };
}

function makeCatalog(rules?: LoadedRule[]): RuleCatalog {
  const defaultRules: LoadedRule[] = [
    {
      id: "CRW-001",
      category: "crawlability",
      title: "Homepage retrievable",
      importance_weight: 5,
      scored: true,
      evaluation: "deterministic",
      connected_tier_only: false,
      applicability: "always",
      standards: { pass: "Homepage returns 2xx", fail: "Homepage unreachable" },
      fidelity_label: "computed",
    },
    {
      id: "SEO-001",
      category: "on_page",
      title: "Unique page title",
      importance_weight: 4,
      scored: true,
      evaluation: "deterministic",
      connected_tier_only: false,
      applicability: "always",
      standards: { pass: "Title present and >= 10 chars", fail: "Title missing" },
      fidelity_label: "computed",
    },
    {
      id: "SPAM-001",
      category: "on_page",
      title: "No spam patterns",
      importance_weight: 0,
      scored: false,
      evaluation: "deterministic",
      connected_tier_only: false,
      applicability: "always",
      standards: { pass: "No spam detected", fail: "Spam patterns detected" },
      fidelity_label: "computed",
    },
  ];
  return new RuleCatalog(rules ?? defaultRules);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runRulesEngine", () => {
  it("runs site-scope rules once and page-scope rules per page", () => {
    const bundle = makeBundle();
    const catalog = makeCatalog();
    const results = runRulesEngine(bundle, catalog);

    // CRW-001 is site-scope → 1 result
    const crw001Results = results.filter((r) => r.rule_id === "CRW-001");
    expect(crw001Results).toHaveLength(1);
    expect(crw001Results[0].page_id).toBe("site");

    // SEO-001 is page-scope → 1 result per page (2 pages)
    const seo001Results = results.filter((r) => r.rule_id === "SEO-001");
    expect(seo001Results).toHaveLength(2);
    expect(seo001Results.map((r) => r.page_id).sort()).toEqual(["page-1", "page-2"]);

    // SPAM-001 is site-scope → 1 result
    const spamResults = results.filter((r) => r.rule_id === "SPAM-001");
    expect(spamResults).toHaveLength(1);
    expect(spamResults[0].page_id).toBe("site");
  });

  it("returns correct results for passing pages", () => {
    const bundle = makeBundle();
    const catalog = makeCatalog([
      {
        id: "SEO-001",
        category: "on_page",
        title: "Unique page title",
        importance_weight: 4,
        scored: true,
        evaluation: "deterministic",
        connected_tier_only: false,
        applicability: "always",
        standards: { pass: "ok", fail: "fail" },
        fidelity_label: "computed",
      },
    ]);
    const results = runRulesEngine(bundle, catalog);

    // Both pages have valid titles → both pass
    const seo001Results = results.filter((r) => r.rule_id === "SEO-001");
    expect(seo001Results).toHaveLength(2);
    for (const r of seo001Results) {
      expect(r.result).toBe("pass");
      expect(r.evidence_ids.length).toBeGreaterThan(0);
    }
  });

  it("returns fail for pages with missing title", () => {
    const bundle = makeBundle({
      pages: [
        makePage({ evidence_id: "page-1", title: null }),
        makePage({ evidence_id: "page-2", title: "Good Title Here" }),
      ],
    });
    const catalog = makeCatalog([
      {
        id: "SEO-001",
        category: "on_page",
        title: "Unique page title",
        importance_weight: 4,
        scored: true,
        evaluation: "deterministic",
        connected_tier_only: false,
        applicability: "always",
        standards: { pass: "ok", fail: "fail" },
        fidelity_label: "computed",
      },
    ]);
    const results = runRulesEngine(bundle, catalog);

    const seo001Results = results.filter((r) => r.rule_id === "SEO-001");
    expect(seo001Results).toHaveLength(2);

    const page1Result = seo001Results.find((r) => r.page_id === "page-1")!;
    expect(page1Result.result).toBe("fail");

    const page2Result = seo001Results.find((r) => r.page_id === "page-2")!;
    expect(page2Result.result).toBe("pass");
  });

  it("handles site-scope CRW-001 with null homepage", () => {
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: null,
        robots: { fetched: false, directives: [] },
        sitemap: { present: false },
        llms_txt: null,
        security: { https_valid: true, hsts: false },
      },
    });
    const catalog = makeCatalog([
      {
        id: "CRW-001",
        category: "crawlability",
        title: "Homepage retrievable",
        importance_weight: 5,
        scored: true,
        evaluation: "deterministic",
        connected_tier_only: false,
        applicability: "always",
        standards: { pass: "ok", fail: "fail" },
        fidelity_label: "computed",
      },
    ]);
    const results = runRulesEngine(bundle, catalog);

    const crw001 = results.find((r) => r.rule_id === "CRW-001")!;
    expect(crw001.result).toBe("fail");
    expect(crw001.cap_trigger).toBe(true);
  });

  it("handles rules with no evaluator as unavailable", () => {
    const bundle = makeBundle();
    const catalog = makeCatalog([
      {
        id: "GSC-001",
        category: "crawlability",
        title: "GSC indexing",
        importance_weight: 3,
        scored: true,
        evaluation: "deterministic",
        connected_tier_only: true,
        applicability: "connected",
        standards: { pass: "ok", fail: "fail" },
        fidelity_label: "computed",
      },
    ]);
    const results = runRulesEngine(bundle, catalog);

    const gsc001 = results.find((r) => r.rule_id === "GSC-001")!;
    expect(gsc001.result).toBe("unavailable");
  });

  it("handles empty pages array gracefully", () => {
    const bundle = makeBundle({ pages: [] });
    const catalog = makeCatalog([
      {
        id: "SEO-001",
        category: "on_page",
        title: "Unique page title",
        importance_weight: 4,
        scored: true,
        evaluation: "deterministic",
        connected_tier_only: false,
        applicability: "always",
        standards: { pass: "ok", fail: "fail" },
        fidelity_label: "computed",
      },
    ]);
    const results = runRulesEngine(bundle, catalog);

    // No pages → no page-scope results
    const seo001Results = results.filter((r) => r.rule_id === "SEO-001");
    expect(seo001Results).toHaveLength(0);
  });

  it("runs multiple rules and returns results for all", () => {
    const bundle = makeBundle();
    const catalog = makeCatalog();
    const results = runRulesEngine(bundle, catalog);

    // Should have results for all 3 rules
    const ruleIds = new Set(results.map((r) => r.rule_id));
    expect(ruleIds.has("CRW-001")).toBe(true);
    expect(ruleIds.has("SEO-001")).toBe(true);
    expect(ruleIds.has("SPAM-001")).toBe(true);

    // Total: 1 (CRW-001) + 2 (SEO-001) + 1 (SPAM-001) = 4
    expect(results).toHaveLength(4);
  });
});
