import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence } from "../src/evidence.js";
import type { PageRuleResult } from "../src/types.js";
import {
  aggregateToSite,
  clusterPagesByTemplate,
  computeTemplateKey,
  findTemplateFailures,
} from "../src/aggregate.js";

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
    title: "Test Page",
    meta_description: "A test page",
    canonical: "https://example.com/",
    lang: "en",
    viewport_meta: "width=device-width, initial-scale=1",
    headings: [{ level: 1, text: "Hello" }],
    word_count: 500,
    main_content_bytes: 3000,
    structured_data: [],
    links: [],
    robots_directive: "index",
    ...overrides,
  };
}

function makeBundle(pages: PageEvidence[]): EvidenceBundle {
  return {
    methodology_version: "0.1.0-draft",
    tier: "rich",
    locale: "en",
    site: {
      root_url: "https://example.com",
      homepage: pages[0] ?? null,
      robots: { fetched: true, directives: [] },
      sitemap: { present: true, url_count: 10 },
      llms_txt: null,
      security: { https_valid: true, hsts: true },
    },
    pages,
    connectors: {},
  };
}

// ─── Aggregation Tests ────────────────────────────────────────────────────────

describe("aggregateToSite", () => {
  it("passes through site-scope results unchanged", () => {
    const results: PageRuleResult[] = [
      { rule_id: "CRW-001", page_id: "site", result: "pass", evidence_ids: ["e1"] },
    ];
    const bundle = makeBundle([makePage()]);
    const siteResults = aggregateToSite(results, bundle);

    expect(siteResults).toHaveLength(1);
    expect(siteResults[0].rule_id).toBe("CRW-001");
    expect(siteResults[0].result).toBe("pass");
    expect(siteResults[0].scope).toBe("site");
  });

  it("aggregates all-pass pages to site pass", () => {
    const results: PageRuleResult[] = [
      { rule_id: "SEO-001", page_id: "p1", result: "pass", evidence_ids: ["e1"] },
      { rule_id: "SEO-001", page_id: "p2", result: "pass", evidence_ids: ["e2"] },
      { rule_id: "SEO-001", page_id: "p3", result: "pass", evidence_ids: ["e3"] },
    ];
    const bundle = makeBundle([
      makePage({ evidence_id: "p1", url: "https://example.com/a" }),
      makePage({ evidence_id: "p2", url: "https://example.com/b" }),
      makePage({ evidence_id: "p3", url: "https://example.com/c" }),
    ]);
    const siteResults = aggregateToSite(results, bundle);

    expect(siteResults).toHaveLength(1);
    expect(siteResults[0].result).toBe("pass");
    expect(siteResults[0].failed_ratio).toBe(0);
  });

  it("applies ratio policy: 3 pass + 2 fail = fail at 0.4 ratio → partial", () => {
    const results: PageRuleResult[] = [
      { rule_id: "SEO-001", page_id: "p1", result: "pass", evidence_ids: ["e1"] },
      { rule_id: "SEO-001", page_id: "p2", result: "pass", evidence_ids: ["e2"] },
      { rule_id: "SEO-001", page_id: "p3", result: "pass", evidence_ids: ["e3"] },
      { rule_id: "SEO-001", page_id: "p4", result: "fail", evidence_ids: ["e4"] },
      { rule_id: "SEO-001", page_id: "p5", result: "fail", evidence_ids: ["e5"] },
    ];
    const bundle = makeBundle([
      makePage({ evidence_id: "p1", url: "https://example.com/1" }),
      makePage({ evidence_id: "p2", url: "https://example.com/2" }),
      makePage({ evidence_id: "p3", url: "https://example.com/3" }),
      makePage({ evidence_id: "p4", url: "https://example.com/4" }),
      makePage({ evidence_id: "p5", url: "https://example.com/5" }),
    ]);
    const siteResults = aggregateToSite(results, bundle);

    // 2/5 = 0.4 < 0.5 → partial
    expect(siteResults[0].result).toBe("partial");
    expect(siteResults[0].failed_ratio).toBeCloseTo(0.4);
  });

  it("applies ratio policy: >= 0.5 ratio → fail", () => {
    const results: PageRuleResult[] = [
      { rule_id: "SEO-001", page_id: "p1", result: "fail", evidence_ids: ["e1"] },
      { rule_id: "SEO-001", page_id: "p2", result: "fail", evidence_ids: ["e2"] },
      { rule_id: "SEO-001", page_id: "p3", result: "fail", evidence_ids: ["e3"] },
      { rule_id: "SEO-001", page_id: "p4", result: "pass", evidence_ids: ["e4"] },
      { rule_id: "SEO-001", page_id: "p5", result: "pass", evidence_ids: ["e5"] },
    ];
    const bundle = makeBundle([
      makePage({ evidence_id: "p1", url: "https://example.com/1" }),
      makePage({ evidence_id: "p2", url: "https://example.com/2" }),
      makePage({ evidence_id: "p3", url: "https://example.com/3" }),
      makePage({ evidence_id: "p4", url: "https://example.com/4" }),
      makePage({ evidence_id: "p5", url: "https://example.com/5" }),
    ]);
    const siteResults = aggregateToSite(results, bundle);

    // 3/5 = 0.6 >= 0.5 → fail
    expect(siteResults[0].result).toBe("fail");
    expect(siteResults[0].failed_ratio).toBeCloseTo(0.6);
    expect(siteResults[0].affected_urls).toHaveLength(3);
  });

  it("partial pages count as 0.5 fail-equivalent", () => {
    const results: PageRuleResult[] = [
      { rule_id: "SEO-001", page_id: "p1", result: "pass", evidence_ids: ["e1"] },
      { rule_id: "SEO-001", page_id: "p2", result: "partial", evidence_ids: ["e2"] },
      { rule_id: "SEO-001", page_id: "p3", result: "partial", evidence_ids: ["e3"] },
      { rule_id: "SEO-001", page_id: "p4", result: "pass", evidence_ids: ["e4"] },
    ];
    const bundle = makeBundle([
      makePage({ evidence_id: "p1", url: "https://example.com/1" }),
      makePage({ evidence_id: "p2", url: "https://example.com/2" }),
      makePage({ evidence_id: "p3", url: "https://example.com/3" }),
      makePage({ evidence_id: "p4", url: "https://example.com/4" }),
    ]);
    const siteResults = aggregateToSite(results, bundle);

    // (0 fail + 0.5*2 partial) / 4 = 1/4 = 0.25 < 0.5 → partial
    expect(siteResults[0].result).toBe("partial");
    expect(siteResults[0].failed_ratio).toBeCloseTo(0.25);
  });

  it("removes not_applicable pages from denominator", () => {
    const results: PageRuleResult[] = [
      { rule_id: "SEO-001", page_id: "p1", result: "fail", evidence_ids: ["e1"] },
      { rule_id: "SEO-001", page_id: "p2", result: "not_applicable", evidence_ids: [] },
      { rule_id: "SEO-001", page_id: "p3", result: "not_applicable", evidence_ids: [] },
      { rule_id: "SEO-001", page_id: "p4", result: "pass", evidence_ids: ["e4"] },
    ];
    const bundle = makeBundle([
      makePage({ evidence_id: "p1", url: "https://example.com/1" }),
      makePage({ evidence_id: "p2", url: "https://example.com/2" }),
      makePage({ evidence_id: "p3", url: "https://example.com/3" }),
      makePage({ evidence_id: "p4", url: "https://example.com/4" }),
    ]);
    const siteResults = aggregateToSite(results, bundle);

    // 1 fail / 2 checked = 0.5 → fail
    expect(siteResults[0].result).toBe("fail");
    expect(siteResults[0].failed_ratio).toBeCloseTo(0.5);
  });

  it("returns not_applicable when all pages are not_applicable", () => {
    const results: PageRuleResult[] = [
      { rule_id: "SEO-011", page_id: "p1", result: "not_applicable", evidence_ids: [] },
      { rule_id: "SEO-011", page_id: "p2", result: "not_applicable", evidence_ids: [] },
    ];
    const bundle = makeBundle([
      makePage({ evidence_id: "p1" }),
      makePage({ evidence_id: "p2" }),
    ]);
    const siteResults = aggregateToSite(results, bundle);

    expect(siteResults[0].result).toBe("not_applicable");
  });

  it("caps affected_urls at 20", () => {
    const pages: PageEvidence[] = [];
    const results: PageRuleResult[] = [];
    for (let i = 0; i < 25; i++) {
      const eid = `p${i}`;
      pages.push(makePage({ evidence_id: eid, url: `https://example.com/page-${i}` }));
      results.push({
        rule_id: "SEO-001",
        page_id: eid,
        result: "fail",
        evidence_ids: [`e${i}`],
      });
    }
    const bundle = makeBundle(pages);
    const siteResults = aggregateToSite(results, bundle);

    expect(siteResults[0].affected_urls).toHaveLength(20);
  });
});

// ─── Template Clustering Tests ────────────────────────────────────────────────

describe("computeTemplateKey", () => {
  it("returns 'root' for root URL", () => {
    expect(computeTemplateKey("https://example.com/")).toBe("root");
  });

  it("groups blog posts together", () => {
    const key1 = computeTemplateKey("https://example.com/blog/post-1");
    const key2 = computeTemplateKey("https://example.com/blog/post-2");
    expect(key1).toBe(key2);
    expect(key1).toBe("blog/post-{id}:d2");
  });

  it("replaces numeric segments with {id}", () => {
    const key1 = computeTemplateKey("https://example.com/products/123");
    const key2 = computeTemplateKey("https://example.com/products/456");
    expect(key1).toBe(key2);
    expect(key1).toContain("{id}");
  });

  it("replaces hex segments with {id}", () => {
    const key1 = computeTemplateKey("https://example.com/items/abc123def");
    const key2 = computeTemplateKey("https://example.com/items/ff00ff00aa");
    expect(key1).toBe(key2);
  });

  it("differentiates by depth", () => {
    const key1 = computeTemplateKey("https://example.com/blog/post");
    const key2 = computeTemplateKey("https://example.com/blog/post/comment");
    expect(key1).not.toBe(key2);
  });

  it("uses first two segments as prefix", () => {
    const key1 = computeTemplateKey("https://example.com/blog/2026/01/post");
    const key2 = computeTemplateKey("https://example.com/blog/2026/02/post");
    // Both have prefix "blog/2026" but depth 4
    expect(key1).toBe(key2);
  });
});

describe("clusterPagesByTemplate", () => {
  it("clusters pages by URL pattern", () => {
    const pages = [
      makePage({ evidence_id: "p1", url: "https://example.com/blog/post-1" }),
      makePage({ evidence_id: "p2", url: "https://example.com/blog/post-2" }),
      makePage({ evidence_id: "p3", url: "https://example.com/blog/post-3" }),
      makePage({ evidence_id: "p4", url: "https://example.com/about" }),
    ];
    const clusters = clusterPagesByTemplate(pages);

    // Should have 2 clusters: blog (3 pages) and about (1 page)
    expect(clusters).toHaveLength(2);

    const blogCluster = clusters.find((c) => c.cluster_key.startsWith("blog"));
    expect(blogCluster).toBeDefined();
    expect(blogCluster!.page_ids).toHaveLength(3);

    const aboutCluster = clusters.find((c) => c.cluster_key === "about:d1");
    expect(aboutCluster).toBeDefined();
    expect(aboutCluster!.page_ids).toHaveLength(1);
  });

  it("handles empty pages array", () => {
    const clusters = clusterPagesByTemplate([]);
    expect(clusters).toHaveLength(0);
  });
});

describe("findTemplateFailures", () => {
  it("produces template-scoped result when >= 60% of cluster pages fail", () => {
    const pages = [
      makePage({ evidence_id: "p1", url: "https://example.com/blog/post-1" }),
      makePage({ evidence_id: "p2", url: "https://example.com/blog/post-2" }),
      makePage({ evidence_id: "p3", url: "https://example.com/blog/post-3" }),
      makePage({ evidence_id: "p4", url: "https://example.com/blog/post-4" }),
      makePage({ evidence_id: "p5", url: "https://example.com/blog/post-5" }),
    ];
    const bundle = makeBundle(pages);

    // 3 out of 5 blog pages fail SEO-001 = 60% → template failure
    const pageResults: PageRuleResult[] = [
      { rule_id: "SEO-001", page_id: "p1", result: "fail", evidence_ids: ["e1"] },
      { rule_id: "SEO-001", page_id: "p2", result: "fail", evidence_ids: ["e2"] },
      { rule_id: "SEO-001", page_id: "p3", result: "fail", evidence_ids: ["e3"] },
      { rule_id: "SEO-001", page_id: "p4", result: "pass", evidence_ids: ["e4"] },
      { rule_id: "SEO-001", page_id: "p5", result: "pass", evidence_ids: ["e5"] },
    ];

    const clusters = clusterPagesByTemplate(pages);
    const templateResults = findTemplateFailures(pageResults, clusters, bundle);

    expect(templateResults).toHaveLength(1);
    expect(templateResults[0].rule_id).toBe("SEO-001");
    expect(templateResults[0].scope).toBe("template");
    expect(templateResults[0].template_cluster_key).toBe("blog/post-{id}:d2");
    expect(templateResults[0].result).toBe("fail");
    expect(templateResults[0].failed_ratio).toBeCloseTo(0.6);
  });

  it("does not produce template result when < 60% fail", () => {
    const pages = [
      makePage({ evidence_id: "p1", url: "https://example.com/blog/post-1" }),
      makePage({ evidence_id: "p2", url: "https://example.com/blog/post-2" }),
      makePage({ evidence_id: "p3", url: "https://example.com/blog/post-3" }),
      makePage({ evidence_id: "p4", url: "https://example.com/blog/post-4" }),
      makePage({ evidence_id: "p5", url: "https://example.com/blog/post-5" }),
    ];
    const bundle = makeBundle(pages);

    // 2 out of 5 = 40% → no template failure
    const pageResults: PageRuleResult[] = [
      { rule_id: "SEO-001", page_id: "p1", result: "fail", evidence_ids: ["e1"] },
      { rule_id: "SEO-001", page_id: "p2", result: "fail", evidence_ids: ["e2"] },
      { rule_id: "SEO-001", page_id: "p3", result: "pass", evidence_ids: ["e3"] },
      { rule_id: "SEO-001", page_id: "p4", result: "pass", evidence_ids: ["e4"] },
      { rule_id: "SEO-001", page_id: "p5", result: "pass", evidence_ids: ["e5"] },
    ];

    const clusters = clusterPagesByTemplate(pages);
    const templateResults = findTemplateFailures(pageResults, clusters, bundle);

    expect(templateResults).toHaveLength(0);
  });

  it("does not produce template result for clusters with < 3 pages", () => {
    const pages = [
      makePage({ evidence_id: "p1", url: "https://example.com/blog/post-1" }),
      makePage({ evidence_id: "p2", url: "https://example.com/blog/post-2" }),
    ];
    const bundle = makeBundle(pages);

    // Both fail, but only 2 pages → no template result
    const pageResults: PageRuleResult[] = [
      { rule_id: "SEO-001", page_id: "p1", result: "fail", evidence_ids: ["e1"] },
      { rule_id: "SEO-001", page_id: "p2", result: "fail", evidence_ids: ["e2"] },
    ];

    const clusters = clusterPagesByTemplate(pages);
    const templateResults = findTemplateFailures(pageResults, clusters, bundle);

    expect(templateResults).toHaveLength(0);
  });
});
