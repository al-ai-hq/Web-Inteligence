import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence, JsonLdBlock } from "../../src/evidence.js";
import {
  evalAEO001,
  evalAEO002,
  evalAEO003,
  evalAEO004,
  evalAEO005,
  evalAEO006,
  evalAEO007,
  evalAEO008,
  evalAEO009,
  evalAEO010,
  evalAEO011,
} from "../../src/evaluators/aeo.js";

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

// ─── AEO-001: Clear offering (assessed) ──────────────────────────────────────

describe("evalAEO001 - Clear offering (assessed)", () => {
  it("returns unavailable because this is an assessed rule", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalAEO001(page, bundle);
    expect(result.result).toBe("unavailable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── AEO-002: Audience clarity ───────────────────────────────────────────────

describe("evalAEO002 - Audience clarity", () => {
  it("returns pass when headings identify target audience", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Solutions for Small Businesses" },
        { level: 2, text: "Built for Developers" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when title identifies audience", () => {
    const page = makePage({
      title: "Project Management for Teams",
      headings: [{ level: 1, text: "Welcome" }],
    });
    const bundle = makeBundle();
    const result = evalAEO002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when meta description identifies audience", () => {
    const page = makePage({
      meta_description: "The ideal platform for freelancers and agencies to manage projects.",
      headings: [{ level: 1, text: "Welcome" }],
    });
    const bundle = makeBundle();
    const result = evalAEO002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no audience indicators found", () => {
    const page = makePage({
      title: "Welcome",
      meta_description: "A generic page with no audience mention.",
      headings: [
        { level: 1, text: "Welcome" },
        { level: 2, text: "About Us" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO002(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── AEO-003: Geographic availability ────────────────────────────────────────

describe("evalAEO003 - Geographic availability", () => {
  it("returns pass when page mentions worldwide availability", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Our Services" },
        { level: 2, text: "Available Worldwide" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO003(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when structured data has areaServed", () => {
    const page = makePage({
      structured_data: [sd("Service", { name: "Consulting", areaServed: "United States" })],
    });
    const bundle = makeBundle();
    const result = evalAEO003(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page mentions specific countries/cities", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Our Offices" },
        { level: 2, text: "London, Berlin, Riyadh" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO003(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no geographic indicators found", () => {
    const page = makePage({
      title: "Our Services",
      headings: [{ level: 1, text: "What We Do" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalAEO003(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── AEO-004: Pricing or pricing explanation ─────────────────────────────────

describe("evalAEO004 - Pricing or pricing explanation", () => {
  it("returns pass when page has pricing headings", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Pricing Plans" },
        { level: 2, text: "Starting at $29/month" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when structured data has price information", () => {
    const page = makePage({
      structured_data: [sd("Product", { name: "Widget", price: "29.99", priceCurrency: "USD" })],
    });
    const bundle = makeBundle();
    const result = evalAEO004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when title mentions pricing", () => {
    const page = makePage({
      title: "Pricing and Plans",
      headings: [{ level: 1, text: "Welcome" }],
    });
    const bundle = makeBundle();
    const result = evalAEO004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no pricing indicators found", () => {
    const page = makePage({
      title: "About Us",
      headings: [{ level: 1, text: "Our Story" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalAEO004(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── AEO-005: Process explanation ────────────────────────────────────────────

describe("evalAEO005 - Process explanation", () => {
  it("returns pass when page has process-related headings", () => {
    const page = makePage({
      url: "https://example.com/services/consulting",
      headings: [
        { level: 1, text: "Our Consulting Process" },
        { level: 2, text: "Step 1: Discovery" },
        { level: 2, text: "Step 2: Implementation" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO005(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when headings explain how it works", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "How It Works" },
        { level: 2, text: "Getting Started" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO005(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no process indicators found", () => {
    const page = makePage({
      title: "Products",
      headings: [{ level: 1, text: "Our Products" }],
    });
    const bundle = makeBundle();
    const result = evalAEO005(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── AEO-006: Direct question answers (assessed) ─────────────────────────────

describe("evalAEO006 - Direct question answers (assessed)", () => {
  it("returns unavailable because this is an assessed rule", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalAEO006(page, bundle);
    expect(result.result).toBe("unavailable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── AEO-007: FAQ quality ────────────────────────────────────────────────────

describe("evalAEO007 - FAQ quality", () => {
  it("returns not_applicable when page has no FAQ-like content", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "About Us" },
        { level: 2, text: "Our Team" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO007(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when page has question-style headings", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Frequently Asked Questions" },
        { level: 2, text: "How do I get started?" },
        { level: 2, text: "What are the pricing options?" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO007(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page has FAQPage structured data", () => {
    const page = makePage({
      structured_data: [
        sd("FAQPage", {
          mainEntity: [{ question: "How?", answer: "Easy." }],
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO007(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when title mentions FAQ", () => {
    const page = makePage({
      title: "FAQ - Common Questions",
      headings: [{ level: 1, text: "Questions" }],
    });
    const bundle = makeBundle();
    const result = evalAEO007(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── AEO-008: Comparison and selection guidance ──────────────────────────────

describe("evalAEO008 - Comparison and selection guidance", () => {
  it("returns pass when page has comparison language", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Compare Plans" },
        { level: 2, text: "Basic vs Pro" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO008(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page discusses trade-offs or suitability", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Which Plan Is Right for You?" },
        { level: 2, text: "Best for Small Teams" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO008(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no comparison indicators found", () => {
    const page = makePage({
      title: "About Us",
      headings: [{ level: 1, text: "Our Story" }],
    });
    const bundle = makeBundle();
    const result = evalAEO008(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── AEO-009: Reader-first organization (assessed) ───────────────────────────

describe("evalAEO009 - Reader-first organization (assessed)", () => {
  it("returns unavailable because this is an assessed rule", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalAEO009(page, bundle);
    expect(result.result).toBe("unavailable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── AEO-010: Content freshness ──────────────────────────────────────────────

describe("evalAEO010 - Content freshness", () => {
  it("returns pass when page has date-modified structured data", () => {
    const page = makePage({
      structured_data: [
        sd("Article", {
          headline: "Test Article",
          dateModified: "2026-01-15",
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO010(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when headings mention update/recency", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Latest Updates" },
        { level: 2, text: "January 2026 Changes" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO010(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no freshness indicators found", () => {
    const page = makePage({
      title: "Evergreen Content",
      headings: [{ level: 1, text: "Guide" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalAEO010(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── AEO-011: Contact and next-step clarity ──────────────────────────────────

describe("evalAEO011 - Contact and next-step clarity", () => {
  it("returns pass when page has contact links", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "mailto:info@example.com" },
        { href: "tel:+1234567890" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO011(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page has CTA headings", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Get Started Today" },
        { level: 2, text: "Contact Us for a Quote" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO011(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when structured data has contactPoint", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", {
          name: "Acme",
          contactPoint: { telephone: "+1234567890" },
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalAEO011(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no contact/CTA indicators found", () => {
    const page = makePage({
      title: "Blog Post",
      headings: [{ level: 1, text: "Article Title" }],
      links: [{ href: "https://example.com/other-post" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalAEO011(page, bundle);
    expect(result.result).toBe("fail");
  });
});
