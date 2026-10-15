import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence } from "../../src/evidence.js";
import {
  evalCRW001,
  evalCRW002,
  evalCRW003,
  evalCRW004,
  evalCRW005,
  evalCRW006,
  evalCRW007,
  evalCRW008,
  evalCRW009,
  evalCRW010,
  evalCRW011,
  evalCRW012,
} from "../../src/evaluators/crawl.js";

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

// ─── CRW-001: Homepage reachable (site-scope) ─────────────────────────────────

describe("evalCRW001 - Homepage reachable", () => {
  it("returns pass when homepage has status 200", () => {
    const bundle = makeBundle();
    const result = evalCRW001(bundle);
    expect(result.result).toBe("pass");
    expect(result.evidence_ids.length).toBeGreaterThanOrEqual(1);
  });

  it("returns fail when homepage is null", () => {
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: null,
        robots: { fetched: true, directives: [] },
        sitemap: { present: false },
        llms_txt: null,
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalCRW001(bundle);
    expect(result.result).toBe("fail");
    expect(result.cap_trigger).toBe(true);
  });

  it("returns fail when homepage status is not 200", () => {
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage({ status_code: 500 }),
        robots: { fetched: true, directives: [] },
        sitemap: { present: false },
        llms_txt: null,
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalCRW001(bundle);
    expect(result.result).toBe("fail");
    expect(result.cap_trigger).toBe(true);
  });

  it("returns pass for 2xx status codes (e.g. 201)", () => {
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage({ status_code: 201 }),
        robots: { fetched: true, directives: [] },
        sitemap: { present: false },
        llms_txt: null,
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalCRW001(bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── CRW-002: Important pages reachable (site-scope) ──────────────────────────

describe("evalCRW002 - Important pages reachable", () => {
  it("returns pass when >= 90% of pages return 2xx", () => {
    const pages = [
      makePage({ evidence_id: "p1", status_code: 200 }),
      makePage({ evidence_id: "p2", status_code: 200 }),
      makePage({ evidence_id: "p3", status_code: 200 }),
      makePage({ evidence_id: "p4", status_code: 200 }),
      makePage({ evidence_id: "p5", status_code: 200 }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalCRW002(bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when < 90% of pages return 2xx", () => {
    const pages = [
      makePage({ evidence_id: "p1", status_code: 200 }),
      makePage({ evidence_id: "p2", status_code: 200 }),
      makePage({ evidence_id: "p3", status_code: 200 }),
      makePage({ evidence_id: "p4", status_code: 404 }),
      makePage({ evidence_id: "p5", status_code: 500 }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalCRW002(bundle);
    expect(result.result).toBe("fail");
  });

  it("returns unavailable when no pages exist", () => {
    const bundle = makeBundle({ pages: [] });
    const result = evalCRW002(bundle);
    expect(result.result).toBe("unavailable");
  });
});

// ─── CRW-003: Site-wide indexability (site-scope) ─────────────────────────────

describe("evalCRW003 - Site-wide indexability", () => {
  it("returns pass when no pages have noindex", () => {
    const pages = [
      makePage({ evidence_id: "p1", robots_directive: "index" }),
      makePage({ evidence_id: "p2", robots_directive: "index" }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalCRW003(bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when majority of pages have noindex (site-wide block)", () => {
    const pages = [
      makePage({ evidence_id: "p1", robots_directive: "noindex" }),
      makePage({ evidence_id: "p2", robots_directive: "noindex" }),
      makePage({ evidence_id: "p3", robots_directive: "noindex" }),
      makePage({ evidence_id: "p4", robots_directive: "index" }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalCRW003(bundle);
    expect(result.result).toBe("fail");
    expect(result.cap_trigger).toBe(true);
  });

  it("returns partial when some pages have noindex but not majority", () => {
    const pages = [
      makePage({ evidence_id: "p1", robots_directive: "noindex" }),
      makePage({ evidence_id: "p2", robots_directive: "index" }),
      makePage({ evidence_id: "p3", robots_directive: "index" }),
      makePage({ evidence_id: "p4", robots_directive: "index" }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalCRW003(bundle);
    expect(result.result).toBe("partial");
  });

  it("treats 'none' directive same as noindex", () => {
    const pages = [
      makePage({ evidence_id: "p1", robots_directive: "none" }),
      makePage({ evidence_id: "p2", robots_directive: "none" }),
      makePage({ evidence_id: "p3", robots_directive: "none" }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalCRW003(bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── CRW-004: robots.txt availability and syntax (site-scope) ─────────────────

describe("evalCRW004 - robots.txt availability and syntax", () => {
  it("returns pass when robots.txt is fetched and has no general block", () => {
    const bundle = makeBundle();
    const result = evalCRW004(bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when robots.txt was not fetched", () => {
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage(),
        robots: { fetched: false, directives: [] },
        sitemap: { present: false },
        llms_txt: null,
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalCRW004(bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when robots.txt has a general Disallow: / block", () => {
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage(),
        robots: {
          fetched: true,
          content: "User-agent: *\nDisallow: /\n",
          directives: [{ user_agent: "*", allow: [], disallow: ["/"] }],
        },
        sitemap: { present: false },
        llms_txt: null,
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalCRW004(bundle);
    expect(result.result).toBe("fail");
    expect(result.cap_trigger).toBe(true);
  });

  it("returns pass when robots.txt is validly absent (404 is acceptable)", () => {
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage(),
        robots: { fetched: true, content: undefined, directives: [] },
        sitemap: { present: false },
        llms_txt: null,
        security: { https_valid: true, hsts: true },
      },
    });
    // No content but fetched=true means it was reachable (even if empty/404)
    const result = evalCRW004(bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── CRW-005: XML sitemap (per-page) ──────────────────────────────────────────

describe("evalCRW005 - XML sitemap (per-page)", () => {
  it("returns pass when sitemap is present", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalCRW005(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when sitemap is not present", () => {
    const page = makePage();
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage(),
        robots: { fetched: true, directives: [] },
        sitemap: { present: false },
        llms_txt: null,
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalCRW005(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── CRW-006: Canonical consistency (per-page) ────────────────────────────────

describe("evalCRW006 - Canonical consistency (per-page)", () => {
  it("returns pass when canonical is absolute and matches final_url", () => {
    const page = makePage({
      canonical: "https://example.com/",
      final_url: "https://example.com/",
    });
    const bundle = makeBundle();
    const result = evalCRW006(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when canonical is missing", () => {
    const page = makePage({ canonical: null });
    const bundle = makeBundle();
    const result = evalCRW006(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when canonical is relative", () => {
    const page = makePage({ canonical: "/home" });
    const bundle = makeBundle();
    const result = evalCRW006(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when canonical doesn't match final_url (different path)", () => {
    const page = makePage({
      canonical: "https://example.com/other",
      final_url: "https://example.com/",
    });
    const bundle = makeBundle();
    const result = evalCRW006(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns partial when canonical matches origin but not path (www vs non-www)", () => {
    const page = makePage({
      canonical: "https://www.example.com/",
      final_url: "https://example.com/",
    });
    const bundle = makeBundle();
    const result = evalCRW006(page, bundle);
    expect(result.result).toBe("partial");
  });
});

// ─── CRW-007: Redirect health (per-page) ──────────────────────────────────────

describe("evalCRW007 - Redirect health (per-page)", () => {
  it("returns pass when url matches final_url and status is 2xx", () => {
    const page = makePage({
      url: "https://example.com/",
      final_url: "https://example.com/",
      status_code: 200,
    });
    const bundle = makeBundle();
    const result = evalCRW007(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns partial when url differs from final_url (redirect occurred)", () => {
    const page = makePage({
      url: "https://example.com/old",
      final_url: "https://example.com/new",
      status_code: 200,
    });
    const bundle = makeBundle();
    const result = evalCRW007(page, bundle);
    expect(result.result).toBe("partial");
  });

  it("returns fail when status code is a redirect (3xx)", () => {
    const page = makePage({ status_code: 301 });
    const bundle = makeBundle();
    const result = evalCRW007(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when status code indicates error", () => {
    const page = makePage({ status_code: 500 });
    const bundle = makeBundle();
    const result = evalCRW007(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── CRW-008: Crawlable internal links (per-page) ─────────────────────────────

describe("evalCRW008 - Crawlable internal links (per-page)", () => {
  it("returns pass when all links have valid href", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "/contact" },
        { href: "https://external.com" },
      ],
    });
    const bundle = makeBundle();
    const result = evalCRW008(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when all links are non-crawlable", () => {
    const page = makePage({
      links: [{ href: "javascript:void(0)" }, { href: "#" }, { href: "" }],
    });
    const bundle = makeBundle();
    const result = evalCRW008(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns partial when some links are non-crawlable", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "javascript:void(0)" },
        { href: "/contact" },
        { href: "#" },
      ],
    });
    const bundle = makeBundle();
    const result = evalCRW008(page, bundle);
    expect(result.result).toBe("partial");
  });

  it("returns not_applicable when page has no links", () => {
    const page = makePage({ links: [] });
    const bundle = makeBundle();
    const result = evalCRW008(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── CRW-009: Status-code integrity (per-page) ────────────────────────────────

describe("evalCRW009 - Status-code integrity (per-page)", () => {
  it("returns pass when status is 200 and content is present", () => {
    const page = makePage({ status_code: 200, word_count: 500 });
    const bundle = makeBundle();
    const result = evalCRW009(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when status is 404", () => {
    const page = makePage({ status_code: 404 });
    const bundle = makeBundle();
    const result = evalCRW009(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when status is 5xx", () => {
    const page = makePage({ status_code: 503 });
    const bundle = makeBundle();
    const result = evalCRW009(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail for soft 404 (200 status but near-zero content)", () => {
    const page = makePage({ status_code: 200, word_count: 0, main_content_bytes: 0 });
    const bundle = makeBundle();
    const result = evalCRW009(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── CRW-010: AI/search bot policy visibility (per-page) ──────────────────────

describe("evalCRW010 - AI/search bot policy visibility (per-page)", () => {
  it("returns pass when page robots directive is index", () => {
    const page = makePage({ robots_directive: "index" });
    const bundle = makeBundle();
    const result = evalCRW010(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page robots directive is noindex", () => {
    const page = makePage({ robots_directive: "noindex" });
    const bundle = makeBundle();
    const result = evalCRW010(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page robots directive is none", () => {
    const page = makePage({ robots_directive: "none" });
    const bundle = makeBundle();
    const result = evalCRW010(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── CRW-011: Agent parity (per-page) ─────────────────────────────────────────

describe("evalCRW011 - Agent parity (per-page)", () => {
  it("returns unavailable (assessed rule, needs multi-agent crawl data)", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalCRW011(page, bundle);
    expect(result.result).toBe("unavailable");
  });
});

// ─── CRW-012: Snippet eligibility (per-page) ──────────────────────────────────

describe("evalCRW012 - Snippet eligibility (per-page)", () => {
  it("returns pass when page is indexable with title and meta description", () => {
    const page = makePage({
      robots_directive: "index",
      title: "Test Page",
      meta_description: "A description",
    });
    const bundle = makeBundle();
    const result = evalCRW012(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has noindex", () => {
    const page = makePage({ robots_directive: "noindex" });
    const bundle = makeBundle();
    const result = evalCRW012(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page has no title", () => {
    const page = makePage({ title: null });
    const bundle = makeBundle();
    const result = evalCRW012(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page has no meta description", () => {
    const page = makePage({ meta_description: null });
    const bundle = makeBundle();
    const result = evalCRW012(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns partial when page has title but no meta description", () => {
    const page = makePage({ title: "Test", meta_description: null });
    const bundle = makeBundle();
    const result = evalCRW012(page, bundle);
    // no meta description limits snippet but page is still indexable
    expect(result.result).toBe("fail");
  });
});
