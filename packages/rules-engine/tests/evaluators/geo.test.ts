import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence, JsonLdBlock } from "../../src/evidence.js";
import {
  evalGEO001,
  evalGEO002,
  evalGEO003,
  evalGEO004,
  evalGEO005,
  evalGEO006,
  evalGEO007,
  evalGEO008,
  evalGEO009,
  evalGEO010,
  evalGEO011,
} from "../../src/evaluators/geo.js";

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

// ─── GEO-001: Consistent entity name ─────────────────────────────────────────

describe("evalGEO001 - Consistent entity name", () => {
  it("returns pass when structured data has consistent organization name", () => {
    const page = makePage({
      structured_data: [sd("Organization", { name: "Acme Corp" })],
      title: "Acme Corp - Home",
    });
    const bundle = makeBundle();
    const result = evalGEO001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when title and meta description share entity name", () => {
    const page = makePage({
      title: "About Acme Corp",
      meta_description: "Acme Corp is a leading provider of solutions.",
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalGEO001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when structured data name matches across pages", () => {
    const orgName = "Acme Corp";
    const page = makePage({
      structured_data: [sd("Organization", { name: orgName })],
    });
    const bundle = makeBundle({
      pages: [
        page,
        makePage({
          evidence_id: "page-2",
          url: "https://example.com/about",
          structured_data: [sd("Organization", { name: orgName })],
        }),
      ],
    });
    const result = evalGEO001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no entity name indicators found", () => {
    const page = makePage({
      title: "Welcome",
      meta_description: "A generic page.",
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalGEO001(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── GEO-002: About/entity page ──────────────────────────────────────────────

describe("evalGEO002 - About/entity page", () => {
  it("returns pass when page is an about page with organization info", () => {
    const page = makePage({
      url: "https://example.com/about",
      title: "About Us - Acme Corp",
      headings: [
        { level: 1, text: "About Acme Corp" },
        { level: 2, text: "Our History" },
        { level: 2, text: "Our Mission" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page has entity-focused structured data", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", {
          name: "Acme Corp",
          description: "We build things.",
          foundingDate: "2010",
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has no about/entity indicators", () => {
    const page = makePage({
      url: "https://example.com/blog/post-1",
      title: "Blog Post",
      headings: [{ level: 1, text: "Some Article" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalGEO002(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── GEO-003: Contact identity ───────────────────────────────────────────────

describe("evalGEO003 - Contact identity", () => {
  it("returns pass when page has contact links", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "mailto:info@example.com" },
        { href: "tel:+1234567890" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO003(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page has contact headings", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Contact Us" },
        { level: 2, text: "Our Office Location" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO003(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when structured data has contact info", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", {
          name: "Acme",
          address: { streetAddress: "123 Main St" },
          telephone: "+1234567890",
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO003(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no contact indicators found", () => {
    const page = makePage({
      title: "Blog Post",
      headings: [{ level: 1, text: "Article" }],
      links: [{ href: "https://example.com/other-post" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalGEO003(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── GEO-004: Author/editor identity ─────────────────────────────────────────

describe("evalGEO004 - Author/editor identity", () => {
  it("returns not_applicable when page is not editorial/advice content", () => {
    const page = makePage({
      url: "https://example.com/pricing",
      title: "Pricing",
      headings: [{ level: 1, text: "Our Plans" }],
    });
    const bundle = makeBundle();
    const result = evalGEO004(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when editorial page has author structured data", () => {
    const page = makePage({
      url: "https://example.com/blog/how-to-choose",
      title: "How to Choose the Best Solution",
      headings: [
        { level: 1, text: "How to Choose the Best Solution" },
        { level: 2, text: "Expert Tips" },
      ],
      structured_data: [
        sd("Article", {
          author: { name: "Jane Doe", type: "Person" },
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when editorial page has author in headings/meta", () => {
    const page = makePage({
      url: "https://example.com/blog/guide",
      title: "Complete Guide to SEO",
      headings: [
        { level: 1, text: "Complete Guide to SEO" },
        { level: 2, text: "By John Smith" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when editorial page has no author information", () => {
    const page = makePage({
      url: "https://example.com/blog/tips",
      title: "10 Tips for Better Results",
      headings: [
        { level: 1, text: "10 Tips for Better Results" },
        { level: 2, text: "Tip 1" },
      ],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalGEO004(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── GEO-005: Evidence for claims (assessed) ─────────────────────────────────

describe("evalGEO005 - Evidence for claims (assessed)", () => {
  it("returns unavailable because this is an assessed rule", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalGEO005(page, bundle);
    expect(result.result).toBe("unavailable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── GEO-006: Source quality ─────────────────────────────────────────────────

describe("evalGEO006 - Source quality", () => {
  it("returns not_applicable when page has no external links (no citations)", () => {
    const page = makePage({
      links: [{ href: "https://example.com/about" }, { href: "https://example.com/contact" }],
    });
    const bundle = makeBundle();
    const result = evalGEO006(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when page has external links to authoritative sources", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "https://en.wikipedia.org/wiki/Example" },
        { href: "https://www.gov.example/data" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO006(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page has links with rel attributes indicating sources", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/page" },
        { href: "https://research.example.com/paper", rel: "nofollow" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO006(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when external links point only to non-authoritative sources", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "https://random-blog-xyz123.com/post" },
        { href: "https://some-forum.net/thread" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO006(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── GEO-007: Non-commodity content (assessed) ───────────────────────────────

describe("evalGEO007 - Non-commodity content (assessed)", () => {
  it("returns unavailable because this is an assessed rule", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalGEO007(page, bundle);
    expect(result.result).toBe("unavailable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── GEO-008: Entity connections ─────────────────────────────────────────────

describe("evalGEO008 - Entity connections", () => {
  it("returns pass when page links to official social profiles", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "https://twitter.com/acmecorp" },
        { href: "https://www.linkedin.com/company/acmecorp" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO008(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when structured data has sameAs profiles", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", {
          name: "Acme Corp",
          sameAs: ["https://twitter.com/acmecorp", "https://www.linkedin.com/company/acmecorp"],
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO008(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when no entity connection indicators found", () => {
    const page = makePage({
      title: "Blog Post",
      headings: [{ level: 1, text: "Article" }],
      links: [{ href: "https://example.com/other-post" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalGEO008(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── GEO-009: Reputation signals on site ─────────────────────────────────────

describe("evalGEO009 - Reputation signals on site", () => {
  it("returns pass when page has credentials or case evidence", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Our Certifications" },
        { level: 2, text: "ISO 9001 Certified" },
        { level: 2, text: "Case Study: Acme Implementation" },
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO009(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when structured data has award/review data", () => {
    const page = makePage({
      structured_data: [
        sd("Organization", {
          award: "Best Place to Work 2025",
          aggregateRating: { ratingValue: "4.8", reviewCount: "120" },
        }),
      ],
    });
    const bundle = makeBundle();
    const result = evalGEO009(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns not_applicable when page has no reputation signal indicators", () => {
    const page = makePage({
      url: "https://example.com/blog/post",
      title: "Blog Post",
      headings: [{ level: 1, text: "Some Article" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalGEO009(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── GEO-010: Optional machine-readable summary (llms.txt) ───────────────────

describe("evalGEO010 - Optional machine-readable summary (llms.txt)", () => {
  it("returns pass when llms.txt is present with valid references", () => {
    const page = makePage();
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage({ evidence_id: "homepage" }),
        robots: { fetched: true, directives: [] },
        sitemap: { present: true },
        llms_txt: { present: true, references: ["https://example.com/about"] },
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalGEO010(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when llms.txt is present but has no references (dead pages)", () => {
    const page = makePage();
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage({ evidence_id: "homepage" }),
        robots: { fetched: true, directives: [] },
        sitemap: { present: true },
        llms_txt: { present: true, references: [] },
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalGEO010(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns not_applicable when llms.txt is absent (absence is never a failure)", () => {
    const page = makePage();
    const bundle = makeBundle({
      site: {
        root_url: "https://example.com",
        homepage: makePage({ evidence_id: "homepage" }),
        robots: { fetched: true, directives: [] },
        sitemap: { present: true },
        llms_txt: null,
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalGEO010(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});

// ─── GEO-011: Business Profile and Merchant Center consistency ───────────────

describe("evalGEO011 - Business profile consistency", () => {
  it("returns pass when business profile data is consistent", () => {
    const page = makePage();
    const bundle = makeBundle({
      business_profile: {
        connector_id: "google_business_profile",
        data: {
          name: "Example Business",
          phone: "+1-555-0100",
          address: "123 Main St, Anytown, CA 90210",
        },
      },
      fact_sheet: {
        business_name: "Example Business",
        phone: "+1-555-0100",
      },
    });
    const result = evalGEO011(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when business profile data conflicts with fact sheet", () => {
    const page = makePage();
    const bundle = makeBundle({
      business_profile: {
        connector_id: "google_business_profile",
        data: {
          name: "Example Business",
          phone: "+1-555-0200",
        },
      },
      fact_sheet: {
        business_name: "Example Business",
        phone: "+1-555-0100",
      },
    });
    const result = evalGEO011(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toContain("phone");
  });

  it("returns not_applicable when no business profile connector data", () => {
    const page = makePage();
    const bundle = makeBundle({
      fact_sheet: {
        business_name: "Example Business",
      },
    });
    const result = evalGEO011(page, bundle);
    expect(result.result).toBe("not_applicable");
  });
});
