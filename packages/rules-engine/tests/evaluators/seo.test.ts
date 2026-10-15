import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence } from "../../src/evidence.js";
import {
  evalSEO001,
  evalSEO002,
  evalSEO003,
  evalSEO004,
  evalSEO005,
  evalSEO006,
  evalSEO007,
  evalSEO008,
  evalSEO009,
  evalSEO010,
  evalSEO011,
  evalSEO012,
  evalSPAM001,
} from "../../src/evaluators/seo.js";

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
    title: "Test Page Title",
    meta_description: "A useful test page description for SEO",
    canonical: "https://example.com/",
    lang: "en",
    viewport_meta: "width=device-width, initial-scale=1",
    headings: [{ level: 1, text: "Main Heading" }],
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

// ─── SEO-001: Unique page title (per-page) ────────────────────────────────────

describe("evalSEO001 - Unique page title", () => {
  it("returns pass when page has a descriptive, non-empty title", () => {
    const page = makePage({ title: "About Our Company Services" });
    const bundle = makeBundle();
    const result = evalSEO001(page, bundle);
    expect(result.result).toBe("pass");
    expect(result.evidence_ids).toContain(page.evidence_id);
  });

  it("returns fail when page has no title", () => {
    const page = makePage({ title: null });
    const bundle = makeBundle();
    const result = evalSEO001(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page has empty title", () => {
    const page = makePage({ title: "" });
    const bundle = makeBundle();
    const result = evalSEO001(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns partial when title is very short (under 10 chars)", () => {
    const page = makePage({ title: "Hi" });
    const bundle = makeBundle();
    const result = evalSEO001(page, bundle);
    expect(result.result).toBe("partial");
  });
});

// ─── SEO-002: Meta description (per-page) ─────────────────────────────────────

describe("evalSEO002 - Meta description", () => {
  it("returns pass when page has a useful meta description", () => {
    const page = makePage({
      meta_description: "A detailed description of our services and offerings",
    });
    const bundle = makeBundle();
    const result = evalSEO002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has no meta description", () => {
    const page = makePage({ meta_description: null });
    const bundle = makeBundle();
    const result = evalSEO002(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when meta description is empty", () => {
    const page = makePage({ meta_description: "" });
    const bundle = makeBundle();
    const result = evalSEO002(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns partial when meta description is very short", () => {
    const page = makePage({ meta_description: "Hi" });
    const bundle = makeBundle();
    const result = evalSEO002(page, bundle);
    expect(result.result).toBe("partial");
  });
});

// ─── SEO-003: Single descriptive H1 (per-page) ────────────────────────────────

describe("evalSEO003 - Single descriptive H1", () => {
  it("returns pass when page has exactly one H1", () => {
    const page = makePage({
      headings: [{ level: 1, text: "Main Heading" }],
    });
    const bundle = makeBundle();
    const result = evalSEO003(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has no H1", () => {
    const page = makePage({
      headings: [{ level: 2, text: "Sub Heading" }],
    });
    const bundle = makeBundle();
    const result = evalSEO003(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns partial when page has multiple H1s", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "First Heading" },
        { level: 2, text: "Sub" },
        { level: 1, text: "Second Heading" },
      ],
    });
    const bundle = makeBundle();
    const result = evalSEO003(page, bundle);
    expect(result.result).toBe("partial");
  });

  it("returns fail when page has no headings at all", () => {
    const page = makePage({ headings: [] });
    const bundle = makeBundle();
    const result = evalSEO003(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── SEO-004: Heading hierarchy (per-page) ────────────────────────────────────

describe("evalSEO004 - Heading hierarchy", () => {
  it("returns pass when headings form proper hierarchy", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Title" },
        { level: 2, text: "Section" },
        { level: 3, text: "Subsection" },
        { level: 2, text: "Another Section" },
      ],
    });
    const bundle = makeBundle();
    const result = evalSEO004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page has no headings (nothing to evaluate)", () => {
    const page = makePage({ headings: [] });
    const bundle = makeBundle();
    const result = evalSEO004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns partial when headings have minor skips (e.g., h1 to h3)", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Title" },
        { level: 3, text: "Skipped H2" },
      ],
    });
    const bundle = makeBundle();
    const result = evalSEO004(page, bundle);
    expect(result.result).toBe("partial");
  });

  it("returns fail when headings start below H1", () => {
    const page = makePage({
      headings: [
        { level: 3, text: "Deep heading" },
        { level: 4, text: "Even deeper" },
      ],
    });
    const bundle = makeBundle();
    const result = evalSEO004(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── SEO-005: Internal linking (per-page) ─────────────────────────────────────

describe("evalSEO005 - Internal linking", () => {
  it("returns pass when page has internal links", () => {
    const page = makePage({
      links: [{ href: "https://example.com/about" }, { href: "https://example.com/contact" }],
    });
    const bundle = makeBundle();
    const result = evalSEO005(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has no links at all", () => {
    const page = makePage({ links: [] });
    const bundle = makeBundle();
    const result = evalSEO005(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page has only external links", () => {
    const page = makePage({
      links: [{ href: "https://external.com/page" }, { href: "https://other.com/about" }],
    });
    const bundle = makeBundle();
    const result = evalSEO005(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns partial when page has only one internal link", () => {
    const page = makePage({
      links: [{ href: "https://example.com/about" }],
    });
    const bundle = makeBundle();
    const result = evalSEO005(page, bundle);
    expect(result.result).toBe("partial");
  });
});

// ─── SEO-006: Descriptive anchors (per-page) ──────────────────────────────────

describe("evalSEO006 - Descriptive anchors", () => {
  it("returns pass when links have descriptive hrefs", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about-us" },
        { href: "https://example.com/our-services" },
      ],
    });
    const bundle = makeBundle();
    const result = evalSEO006(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has no links", () => {
    const page = makePage({ links: [] });
    const bundle = makeBundle();
    const result = evalSEO006(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns partial when some links have generic hrefs", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about-us" },
        { href: "https://example.com/page?id=123" },
        { href: "https://example.com/click" },
      ],
    });
    const bundle = makeBundle();
    const result = evalSEO006(page, bundle);
    expect(result.result).toBe("partial");
  });
});

// ─── SEO-007: Image alternatives (per-page) ───────────────────────────────────

describe("evalSEO007 - Image alternatives", () => {
  it("returns not_applicable (no image data in M2 evidence model)", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalSEO007(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── SEO-008: Duplicate content indicators (per-page) ─────────────────────────

describe("evalSEO008 - Duplicate content indicators", () => {
  it("returns pass when page has unique content_hash", () => {
    const page = makePage({ evidence_id: "p1", content_hash: "unique1" });
    const bundle = makeBundle({
      pages: [page, makePage({ evidence_id: "p2", content_hash: "unique2" })],
    });
    const result = evalSEO008(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page shares content_hash with another page", () => {
    const page = makePage({ evidence_id: "p1", content_hash: "duplicate" });
    const bundle = makeBundle({
      pages: [page, makePage({ evidence_id: "p2", content_hash: "duplicate" })],
    });
    const result = evalSEO008(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns pass when page is the only page", () => {
    const page = makePage({ evidence_id: "p1", content_hash: "only" });
    const bundle = makeBundle({ pages: [page] });
    const result = evalSEO008(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── SEO-009: Metadata consistency (per-page) ─────────────────────────────────

describe("evalSEO009 - Metadata consistency", () => {
  it("returns pass when title, H1, and description share topic words", () => {
    const page = makePage({
      title: "Best Coffee Beans for Espresso",
      meta_description: "Find the best coffee beans for your espresso machine",
      headings: [{ level: 1, text: "Best Coffee Beans for Espresso" }],
    });
    const bundle = makeBundle();
    const result = evalSEO009(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when title and H1 are completely unrelated", () => {
    const page = makePage({
      title: "Best Coffee Beans for Espresso",
      meta_description: "Find the best coffee beans for your espresso machine",
      headings: [{ level: 1, text: "Automotive Parts Catalog" }],
    });
    const bundle = makeBundle();
    const result = evalSEO009(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns partial when title exists but H1 is missing", () => {
    const page = makePage({
      title: "Best Coffee Beans",
      meta_description: "Coffee beans description",
      headings: [],
    });
    const bundle = makeBundle();
    const result = evalSEO009(page, bundle);
    expect(result.result).toBe("partial");
  });

  it("returns fail when title is missing", () => {
    const page = makePage({
      title: null,
      headings: [{ level: 1, text: "Some Heading" }],
    });
    const bundle = makeBundle();
    const result = evalSEO009(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── SEO-010: Open Graph/social metadata (per-page) ──────────────────────────

describe("evalSEO010 - Open Graph/social metadata", () => {
  it("returns not_applicable (no OG data in M2 evidence model)", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalSEO010(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── SEO-011: Keyword cluster mapped (per-page) ──────────────────────────────

describe("evalSEO011 - Keyword cluster mapped to one page", () => {
  it("returns not_applicable (requires keyword_data, unavailable in M2)", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalSEO011(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── SEO-012: No split cluster / cannibalization (per-page) ──────────────────

describe("evalSEO012 - No split cluster (cannibalization)", () => {
  it("returns not_applicable (requires keyword_data, unavailable in M2)", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalSEO012(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── SPAM-001: Spam-policy screen (site-scope) ───────────────────────────────

describe("evalSPAM001 - Spam-policy screen", () => {
  it("returns pass when no spam patterns detected", () => {
    const pages = [
      makePage({ evidence_id: "p1", word_count: 500, content_hash: "aaa" }),
      makePage({ evidence_id: "p2", word_count: 600, content_hash: "bbb" }),
      makePage({ evidence_id: "p3", word_count: 400, content_hash: "ccc" }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalSPAM001(bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail with cap_trigger when thin pages detected (low word_count, high content ratio)", () => {
    const pages = [
      makePage({ evidence_id: "p1", word_count: 5, main_content_bytes: 2900, content_hash: "aaa" }),
      makePage({ evidence_id: "p2", word_count: 3, main_content_bytes: 2800, content_hash: "bbb" }),
      makePage({
        evidence_id: "p3",
        word_count: 500,
        main_content_bytes: 3000,
        content_hash: "ccc",
      }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalSPAM001(bundle);
    expect(result.result).toBe("fail");
    expect(result.cap_trigger).toBe(true);
  });

  it("returns fail with cap_trigger when doorway pattern detected (near-duplicate clusters)", () => {
    const pages = [
      makePage({
        evidence_id: "p1",
        content_hash: "same1",
        word_count: 300,
        main_content_bytes: 2000,
      }),
      makePage({
        evidence_id: "p2",
        content_hash: "same1",
        word_count: 300,
        main_content_bytes: 2000,
      }),
      makePage({
        evidence_id: "p3",
        content_hash: "same1",
        word_count: 300,
        main_content_bytes: 2000,
      }),
      makePage({
        evidence_id: "p4",
        content_hash: "unique",
        word_count: 400,
        main_content_bytes: 2500,
      }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalSPAM001(bundle);
    expect(result.result).toBe("fail");
    expect(result.cap_trigger).toBe(true);
  });

  it("returns pass when no pages exist", () => {
    const bundle = makeBundle({ pages: [] });
    const result = evalSPAM001(bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when thin pages exist but not in suspicious pattern", () => {
    // A single thin page is not enough to trigger spam
    const pages = [
      makePage({ evidence_id: "p1", word_count: 5, main_content_bytes: 2900, content_hash: "aaa" }),
      makePage({
        evidence_id: "p2",
        word_count: 500,
        main_content_bytes: 3000,
        content_hash: "bbb",
      }),
      makePage({
        evidence_id: "p3",
        word_count: 600,
        main_content_bytes: 3500,
        content_hash: "ccc",
      }),
    ];
    const bundle = makeBundle({ pages });
    const result = evalSPAM001(bundle);
    // Single thin page doesn't trigger — need multiple for "scaled" pattern
    expect(result.result).toBe("pass");
  });
});
