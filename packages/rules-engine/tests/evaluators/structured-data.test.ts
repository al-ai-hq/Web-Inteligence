import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence, JsonLdBlock } from "../../src/evidence.js";
import {
  evalSTR001,
  evalSTR002,
  evalSTR003,
  evalSTR004,
  evalSTR005,
  evalSTR006,
  evalSTR007,
  evalSTR008,
} from "../../src/evaluators/structured-data.js";

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
    meta_description: "A test page description",
    canonical: "https://example.com/",
    lang: "en",
    viewport_meta: "width=device-width, initial-scale=1",
    headings: [{ level: 1, text: "Hello" }],
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
    pages: [makePage()],
    connectors: {},
    ...overrides,
  };
}

function sd(type: string, data: Record<string, unknown> = {}): JsonLdBlock {
  return { type, data };
}

// ─── STR-001: Parseable structured data ──────────────────────────────────────

describe("evalSTR001 - Parseable structured data", () => {
  it("returns not_applicable when page has no structured data", () => {
    const page = makePage({ structured_data: [] });
    const bundle = makeBundle();
    const result = evalSTR001(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when page has valid JSON-LD blocks", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", { name: "Acme" }),
        sd("WebSite", { name: "Acme Home" }),
      ],
    });
    const bundle = makeBundle();
    const result = evalSTR001(page, bundle);
    expect(result.result).toBe("pass");
    expect(result.evidence_ids).toContain("page-1");
  });

  it("returns pass even when a block has empty data (still parseable)", () => {
    const page = makePage({
      structured_data: [sd("Organization", {})],
    });
    const bundle = makeBundle();
    const result = evalSTR001(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── STR-002: Appropriate organization/entity type ───────────────────────────

describe("evalSTR002 - Appropriate organization/entity type", () => {
  it("returns not_applicable when page has no entity-type structured data", () => {
    const page = makePage({
      structured_data: [sd("Product", { name: "Widget" })],
    });
    const bundle = makeBundle();
    const result = evalSTR002(page, bundle);
    // Product is not an entity type in our check list (Organization, LocalBusiness, etc.)
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when entity type has a name property", () => {
    const page = makePage({
      structured_data: [sd("Organization", { name: "Acme Corp" })],
    });
    const bundle = makeBundle();
    const result = evalSTR002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when entity type is missing name property", () => {
    const page = makePage({
      structured_data: [sd("Organization", { url: "https://example.com" })],
    });
    const bundle = makeBundle();
    const result = evalSTR002(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns pass for LocalBusiness with name", () => {
    const page = makePage({
      structured_data: [sd("LocalBusiness", { name: "Acme Plumbing" })],
    });
    const bundle = makeBundle();
    const result = evalSTR002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail for LocalBusiness without name", () => {
    const page = makePage({
      structured_data: [sd("LocalBusiness", { address: "123 Main St" })],
    });
    const bundle = makeBundle();
    const result = evalSTR002(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns not_applicable when page has no structured data at all", () => {
    const page = makePage({ structured_data: [] });
    const bundle = makeBundle();
    const result = evalSTR002(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── STR-003: Required properties ────────────────────────────────────────────

describe("evalSTR003 - Required properties", () => {
  it("returns unavailable because schema-requirements are to_verify_at_m0b", () => {
    const page = makePage({
      structured_data: [sd("Product", { name: "Widget" })],
    });
    const bundle = makeBundle();
    const result = evalSTR003(page, bundle);
    expect(result.result).toBe("unavailable");
  });

  it("returns not_applicable when page has no structured data", () => {
    const page = makePage({ structured_data: [] });
    const bundle = makeBundle();
    const result = evalSTR003(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── STR-004: Recommended factual properties ─────────────────────────────────

describe("evalSTR004 - Recommended factual properties", () => {
  it("returns unavailable because schema-requirements are to_verify_at_m0b", () => {
    const page = makePage({
      structured_data: [sd("Article", { headline: "Test" })],
    });
    const bundle = makeBundle();
    const result = evalSTR004(page, bundle);
    expect(result.result).toBe("unavailable");
  });

  it("returns not_applicable when page has no structured data", () => {
    const page = makePage({ structured_data: [] });
    const bundle = makeBundle();
    const result = evalSTR004(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── STR-005: Visible-content consistency ────────────────────────────────────

describe("evalSTR005 - Visible-content consistency", () => {
  it("returns not_applicable when page has no structured data", () => {
    const page = makePage({ structured_data: [] });
    const bundle = makeBundle();
    const result = evalSTR005(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when Organization name matches page title words", () => {
    const page = makePage({
      title: "Acme Corp - Home",
      structured_data: [sd("Organization", { name: "Acme Corp" })],
    });
    const bundle = makeBundle();
    const result = evalSTR005(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when Organization name has no overlap with page title", () => {
    const page = makePage({
      title: "Best Plumbing Services in Riyadh",
      structured_data: [sd("Organization", { name: "Totally Different Company XYZ" })],
    });
    const bundle = makeBundle();
    const result = evalSTR005(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns pass when Article headline overlaps with H1", () => {
    const page = makePage({
      title: "How to Fix Pipes",
      headings: [{ level: 1, text: "How to Fix Pipes: A Guide" }],
      structured_data: [sd("Article", { headline: "How to Fix Pipes" })],
    });
    const bundle = makeBundle();
    const result = evalSTR005(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when Article headline has no overlap with H1", () => {
    const page = makePage({
      title: "Plumbing Guide",
      headings: [{ level: 1, text: "Complete Plumbing Guide" }],
      structured_data: [sd("Article", { headline: "Random Unrelated Topic" })],
    });
    const bundle = makeBundle();
    const result = evalSTR005(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns pass for types without consistency checks (e.g. BreadcrumbList)", () => {
    const page = makePage({
      structured_data: [sd("BreadcrumbList", { itemListElement: [] })],
    });
    const bundle = makeBundle();
    const result = evalSTR005(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── STR-006: Stable entity identifiers ──────────────────────────────────────

describe("evalSTR006 - Stable entity identifiers", () => {
  it("returns not_applicable when page has no entity-type structured data", () => {
    const page = makePage({
      structured_data: [sd("Product", { name: "Widget" })],
    });
    const bundle = makeBundle();
    const result = evalSTR006(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when entity has @id, name, url, and logo", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", {
          "@id": "https://example.com/#org",
          name: "Acme",
          url: "https://example.com",
          logo: "https://example.com/logo.png",
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalSTR006(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns partial when entity has name and url but no @id or logo", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", {
          name: "Acme",
          url: "https://example.com",
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalSTR006(page, bundle);
    expect(result.result).toBe("partial");
  });

  it("returns fail when entity has only a name (missing url and logo)", () => {
    const page = makePage({
      structured_data: [sd("Organization", { name: "Acme" })],
    });
    const bundle = makeBundle();
    const result = evalSTR006(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns not_applicable when no structured data at all", () => {
    const page = makePage({ structured_data: [] });
    const bundle = makeBundle();
    const result = evalSTR006(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("checks consistency across pages for same @id", () => {
    const orgData = {
      "@id": "https://example.com/#org",
      name: "Acme",
      url: "https://example.com",
      logo: "https://example.com/logo.png",
    };
    const page1 = makePage({
      evidence_id: "page-1",
      structured_data: [sd("Organization", { ...orgData })],
    });
    const page2 = makePage({
      evidence_id: "page-2",
      structured_data: [
        sd("Organization", { ...orgData, name: "Different Name" }),
      ],
    });
    const bundle = makeBundle({ pages: [page1, page2] });
    const result = evalSTR006(page1, bundle);
    // Inconsistent name for same @id → fail
    expect(result.result).toBe("fail");
  });
});

// ─── STR-007: Breadcrumb markup ──────────────────────────────────────────────

describe("evalSTR007 - Breadcrumb markup", () => {
  it("returns not_applicable when page has no structured data", () => {
    const page = makePage({ structured_data: [] });
    const bundle = makeBundle();
    const result = evalSTR007(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when page has valid BreadcrumbList with itemListElement", () => {
    const page = makePage({
      structured_data: [
        sd("BreadcrumbList", {
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://example.com/" },
            { "@type": "ListItem", position: 2, name: "About", item: "https://example.com/about" },
          ],
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalSTR007(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has BreadcrumbList but empty itemListElement", () => {
    const page = makePage({
      structured_data: [sd("BreadcrumbList", { itemListElement: [] })],
    });
    const bundle = makeBundle();
    const result = evalSTR007(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page has BreadcrumbList but missing itemListElement", () => {
    const page = makePage({
      structured_data: [sd("BreadcrumbList", {})],
    });
    const bundle = makeBundle();
    const result = evalSTR007(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page has deep path but no BreadcrumbList", () => {
    const page = makePage({
      url: "https://example.com/a/b/c",
      final_url: "https://example.com/a/b/c",
      structured_data: [sd("Organization", { name: "Acme" })],
    });
    const bundle = makeBundle();
    const result = evalSTR007(page, bundle);
    // Has structured data and deep path but no BreadcrumbList
    expect(result.result).toBe("fail");
  });

  it("returns pass when page has non-breadcrumb SD and shallow path (not applicable for breadcrumbs)", () => {
    const page = makePage({
      url: "https://example.com/",
      final_url: "https://example.com/",
      structured_data: [sd("Organization", { name: "Acme" })],
    });
    const bundle = makeBundle();
    const result = evalSTR007(page, bundle);
    // Homepage / shallow path - breadcrumbs not needed
    expect(result.result).toBe("pass");
  });
});

// ─── STR-008: Unsupported/spam markup ────────────────────────────────────────

describe("evalSTR008 - Unsupported/spam markup", () => {
  it("returns not_applicable when page has no structured data", () => {
    const page = makePage({ structured_data: [] });
    const bundle = makeBundle();
    const result = evalSTR008(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when page has only supported, non-spam types", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", { name: "Acme" }),
        sd("WebSite", { name: "Acme Home" }),
      ],
    });
    const bundle = makeBundle();
    const result = evalSTR008(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has Review markup (fabrication risk)", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", { name: "Acme" }),
        sd("Review", { reviewRating: { ratingValue: 5 } }),
      ],
    });
    const bundle = makeBundle();
    const result = evalSTR008(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page has AggregateRating markup (fabrication risk)", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", { name: "Acme" }),
        sd("AggregateRating", { ratingValue: 4.8, reviewCount: 100 }),
      ],
    });
    const bundle = makeBundle();
    const result = evalSTR008(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns pass when page has no spam types", () => {
    const page = makePage({
      structured_data: [
        sd("Article", { headline: "Test Article", author: { name: "John" } }),
      ],
    });
    const bundle = makeBundle();
    const result = evalSTR008(page, bundle);
    expect(result.result).toBe("pass");
  });
});
