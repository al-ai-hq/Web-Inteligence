import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence, JsonLdBlock } from "../../src/evidence.js";
import {
  evalI18N001,
  evalI18N002,
  evalI18N003,
  evalI18N004,
  evalA11Y001,
  evalA11Y002,
  evalA11Y003,
  evalA11Y004,
  evalMOB001,
  evalAGT001,
  evalAGT002,
} from "../../src/evaluators/i18n-accessibility.js";

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

// ─── I18N-001: Document language ─────────────────────────────────────────────

describe("evalI18N001 - Document language", () => {
  it("returns pass when page declares valid BCP 47 language", () => {
    const page = makePage({ lang: "en" });
    const bundle = makeBundle();
    const result = evalI18N001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass for language with region subtag", () => {
    const page = makePage({ lang: "en-US" });
    const bundle = makeBundle();
    const result = evalI18N001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass for Arabic language", () => {
    const page = makePage({ lang: "ar" });
    const bundle = makeBundle();
    const result = evalI18N001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page has no lang", () => {
    const page = makePage({ lang: null });
    const bundle = makeBundle();
    const result = evalI18N001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns fail for invalid language code", () => {
    const page = makePage({ lang: "xx-invalid" });
    const bundle = makeBundle();
    const result = evalI18N001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns fail for 'english' (not a valid BCP 47 code)", () => {
    const page = makePage({ lang: "english" });
    const bundle = makeBundle();
    const result = evalI18N001(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail for 'frazzle' (not a valid BCP 47 code)", () => {
    const page = makePage({ lang: "frazzle" });
    const bundle = makeBundle();
    const result = evalI18N001(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail for 'arabic' (not a valid BCP 47 code)", () => {
    const page = makePage({ lang: "arabic" });
    const bundle = makeBundle();
    const result = evalI18N001(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── I18N-002: Directionality ────────────────────────────────────────────────

describe("evalI18N002 - Directionality", () => {
  it("returns not_applicable for LTR pages", () => {
    const page = makePage({ lang: "en" });
    const bundle = makeBundle();
    const result = evalI18N002(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass for RTL page with direction in structured data", () => {
    const page = makePage({
      lang: "ar",
      structured_data: [sd("WebPage", { inLanguage: "ar", direction: "rtl" })],
    });
    const bundle = makeBundle();
    const result = evalI18N002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass for RTL page with RTL inLanguage in structured data", () => {
    const page = makePage({
      lang: "ar",
      structured_data: [sd("WebPage", { inLanguage: "ar" })],
    });
    const bundle = makeBundle();
    const result = evalI18N002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail for RTL page without direction markers", () => {
    const page = makePage({
      lang: "ar",
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalI18N002(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns not_applicable when lang is null", () => {
    const page = makePage({ lang: null });
    const bundle = makeBundle();
    const result = evalI18N002(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass for Hebrew (RTL) with direction", () => {
    const page = makePage({
      lang: "he",
      structured_data: [sd("WebPage", { direction: "rtl" })],
    });
    const bundle = makeBundle();
    const result = evalI18N002(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── I18N-003: hreflang ──────────────────────────────────────────────────────

describe("evalI18N003 - hreflang", () => {
  it("returns not_applicable when no localized equivalents exist", () => {
    const page = makePage({
      links: [{ href: "https://example.com/about" }],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalI18N003(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns fail when only alternate links exist (no inLanguage SD)", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "https://example.com/ar/", rel: "alternate" },
      ],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalI18N003(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when only structured data has inLanguage (no alternate links)", () => {
    const page = makePage({
      links: [{ href: "https://example.com/about" }],
      structured_data: [sd("WebPage", { inLanguage: "en" })],
    });
    const bundle = makeBundle();
    const result = evalI18N003(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns pass when both alternate links and inLanguage SD exist", () => {
    const page = makePage({
      links: [{ href: "https://example.com/ar/", rel: "alternate" }],
      structured_data: [sd("WebPage", { inLanguage: "en" })],
    });
    const bundle = makeBundle();
    const result = evalI18N003(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when only inLanguage SD exists without alternate links", () => {
    const page = makePage({
      links: [{ href: "https://example.com/about" }],
      structured_data: [sd("WebPage", { inLanguage: "en" })],
    });
    const bundle = makeBundle();
    const result = evalI18N003(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when only alternate links exist without inLanguage SD", () => {
    const page = makePage({
      links: [
        { href: "https://example.com/about" },
        { href: "https://example.com/ar/", rel: "alternate" },
      ],
      structured_data: [],
    });
    const bundle = makeBundle();
    const result = evalI18N003(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when inLanguage contains invalid BCP 47 code", () => {
    const page = makePage({
      links: [{ href: "https://example.com/ar/", rel: "alternate" }],
      structured_data: [sd("WebPage", { inLanguage: "frazzle" })],
    });
    const bundle = makeBundle();
    const result = evalI18N003(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── I18N-004: Localized metadata ────────────────────────────────────────────

describe("evalI18N004 - Localized metadata", () => {
  it("returns pass when content locale matches bundle locale (en)", () => {
    const page = makePage({
      lang: "en",
      title: "The Best Services for Business",
      meta_description: "We provide the best services and solutions for businesses.",
      headings: [{ level: 1, text: "Our Services and Solutions" }],
    });
    const bundle = makeBundle({ locale: "en" });
    const result = evalI18N004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page lang matches bundle locale and content is undetectable", () => {
    const page = makePage({
      lang: "en",
      title: "Welcome",
      meta_description: "Page",
      headings: [{ level: 1, text: "Info" }],
    });
    const bundle = makeBundle({ locale: "en" });
    const result = evalI18N004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when content locale mismatches bundle locale", () => {
    const page = makePage({
      lang: "en",
      title: "مرحبا بكم",
      meta_description: "خدمات متنوعة للشركات",
      headings: [{ level: 1, text: "اهلا وسهلا" }],
    });
    const bundle = makeBundle({ locale: "en" });
    const result = evalI18N004(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns fail when page lang mismatches bundle locale", () => {
    const page = makePage({
      lang: "fr",
      title: "Welcome",
      meta_description: "A page",
      headings: [{ level: 1, text: "Info" }],
    });
    const bundle = makeBundle({ locale: "en" });
    const result = evalI18N004(page, bundle);
    expect(result.result).toBe("fail");
  });

  it("returns fail when page has no lang", () => {
    const page = makePage({ lang: null });
    const bundle = makeBundle({ locale: "en" });
    const result = evalI18N004(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns pass for Arabic content in Arabic bundle", () => {
    const page = makePage({
      lang: "ar",
      title: "مرحبا بكم في موقعنا",
      meta_description: "خدمات متنوعة للشركات والمؤسسات",
      headings: [{ level: 1, text: "اهلا وسهلا بكم" }],
    });
    const bundle = makeBundle({ locale: "ar" });
    const result = evalI18N004(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── A11Y-001: Semantic landmarks ────────────────────────────────────────────

describe("evalA11Y001 - Semantic landmarks", () => {
  it("returns not_applicable because this requires interactive DOM inspection", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalA11Y001(page, bundle);
    expect(result.result).toBe("not_applicable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── A11Y-002: Accessible names ──────────────────────────────────────────────

describe("evalA11Y002 - Accessible names", () => {
  it("returns not_applicable because this requires interactive DOM inspection", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalA11Y002(page, bundle);
    expect(result.result).toBe("not_applicable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── A11Y-003: Keyboard/focus basics ─────────────────────────────────────────

describe("evalA11Y003 - Keyboard/focus basics", () => {
  it("returns not_applicable because this requires interactive keyboard testing", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalA11Y003(page, bundle);
    expect(result.result).toBe("not_applicable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── A11Y-004: Contrast and reflow sample ────────────────────────────────────

describe("evalA11Y004 - Contrast and reflow sample", () => {
  it("returns not_applicable because this requires CSS analysis", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalA11Y004(page, bundle);
    expect(result.result).toBe("not_applicable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── MOB-001: Mobile viewport and layout ─────────────────────────────────────

describe("evalMOB001 - Mobile viewport and layout", () => {
  it("returns pass when viewport declares width=device-width", () => {
    const page = makePage({ viewport_meta: "width=device-width, initial-scale=1" });
    const bundle = makeBundle();
    const result = evalMOB001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when viewport contains width=device-width among other values", () => {
    const page = makePage({
      viewport_meta: "width=device-width, initial-scale=1, maximum-scale=5",
    });
    const bundle = makeBundle();
    const result = evalMOB001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when viewport meta is missing", () => {
    const page = makePage({ viewport_meta: null });
    const bundle = makeBundle();
    const result = evalMOB001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns fail when viewport does not include width=device-width", () => {
    const page = makePage({ viewport_meta: "width=1024" });
    const bundle = makeBundle();
    const result = evalMOB001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });
});

// ─── AGT-001: Agent-operable forms and actions ───────────────────────────────

describe("evalAGT001 - Agent-operable forms and actions", () => {
  it("returns not_applicable when no forms or actions exist", () => {
    const page = makePage({
      links: [{ href: "https://example.com/about" }],
      structured_data: [],
      headings: [{ level: 1, text: "About Us" }],
    });
    const bundle = makeBundle();
    const result = evalAGT001(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass when page has form-related links", () => {
    const page = makePage({
      links: [{ href: "https://example.com/about" }, { href: "https://example.com/contact" }],
    });
    const bundle = makeBundle();
    const result = evalAGT001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when page has booking URL", () => {
    const page = makePage({
      links: [{ href: "https://example.com/booking" }],
    });
    const bundle = makeBundle();
    const result = evalAGT001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when structured data has form/action type", () => {
    const page = makePage({
      structured_data: [sd("OrderAction", { target: "https://example.com/order" })],
    });
    const bundle = makeBundle();
    const result = evalAGT001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns pass when headings mention form-related keywords", () => {
    const page = makePage({
      headings: [
        { level: 1, text: "Request a Quote" },
        { level: 2, text: "Fill Out the Form" },
      ],
    });
    const bundle = makeBundle();
    const result = evalAGT001(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── AGT-002: WebMCP and Lighthouse agentic checks ───────────────────────────

describe("evalAGT002 - WebMCP and Lighthouse agentic checks", () => {
  it("returns not_applicable because this requires experimental features", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalAGT002(page, bundle);
    expect(result.result).toBe("not_applicable");
    expect(result.rationale).toBeDefined();
  });
});
