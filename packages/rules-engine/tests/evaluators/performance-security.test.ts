import { describe, it, expect } from "vitest";
import type { EvidenceBundle, PageEvidence, PsiEvidence } from "../../src/evidence.js";
import {
  evalPRF001,
  evalPRF002,
  evalPRF003,
  evalPRF004,
  evalSEC001,
  evalSEC002,
  evalSEC003,
  evalDEL001,
} from "../../src/evaluators/performance-security.js";

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

function makePsi(overrides: Partial<PsiEvidence> = {}): PsiEvidence {
  return {
    performance_score: 90,
    lcp: 1800,
    fid: 50,
    cls: 0.05,
    ...overrides,
  };
}

// ─── PRF-001: HTTPS ──────────────────────────────────────────────────────────

describe("evalPRF001 - HTTPS", () => {
  it("returns pass when site has valid HTTPS", () => {
    const page = makePage();
    const bundle = makeBundle({
      site: {
        ...makeBundle().site,
        security: { https_valid: true, hsts: true },
      },
    });
    const result = evalPRF001(page, bundle);
    expect(result.result).toBe("pass");
    expect(result.evidence_ids).toContain(page.evidence_id);
  });

  it("returns fail when HTTPS is not valid", () => {
    const page = makePage();
    const bundle = makeBundle({
      site: {
        ...makeBundle().site,
        security: { https_valid: false, hsts: false },
      },
    });
    const result = evalPRF001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns fail when HTTPS has a certificate error", () => {
    const page = makePage();
    const bundle = makeBundle({
      site: {
        ...makeBundle().site,
        security: { https_valid: false, cert_error: "CERT_EXPIRED", hsts: false },
      },
    });
    const result = evalPRF001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });
});

// ─── PRF-002: Response timing ────────────────────────────────────────────────

describe("evalPRF002 - Response timing", () => {
  it("returns pass when all Core Web Vitals are within thresholds", () => {
    const page = makePage();
    const bundle = makeBundle({
      connectors: { psi: makePsi({ performance_score: 90, lcp: 1800, fid: 50, cls: 0.05 }) },
    });
    const result = evalPRF002(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when LCP exceeds threshold", () => {
    const page = makePage();
    const bundle = makeBundle({
      connectors: { psi: makePsi({ lcp: 4000 }) },
    });
    const result = evalPRF002(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns fail when CLS exceeds threshold", () => {
    const page = makePage();
    const bundle = makeBundle({
      connectors: { psi: makePsi({ cls: 0.3 }) },
    });
    const result = evalPRF002(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns fail when FID exceeds threshold", () => {
    const page = makePage();
    const bundle = makeBundle({
      connectors: { psi: makePsi({ fid: 200 }) },
    });
    const result = evalPRF002(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns not_applicable when no PSI data is available", () => {
    const page = makePage();
    const bundle = makeBundle({ connectors: {} });
    const result = evalPRF002(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass at exact threshold boundaries (good)", () => {
    const page = makePage();
    const bundle = makeBundle({
      connectors: { psi: makePsi({ lcp: 2500, fid: 100, cls: 0.1 }) },
    });
    const result = evalPRF002(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── PRF-003: Asset efficiency ───────────────────────────────────────────────

describe("evalPRF003 - Asset efficiency", () => {
  it("returns not_applicable because asset waste data is not available in evidence", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalPRF003(page, bundle);
    expect(result.result).toBe("not_applicable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── PRF-004: Layout stability sample ────────────────────────────────────────

describe("evalPRF004 - Layout stability sample", () => {
  it("returns pass when CLS is within threshold", () => {
    const page = makePage();
    const bundle = makeBundle({
      connectors: { psi: makePsi({ cls: 0.05 }) },
    });
    const result = evalPRF004(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when CLS exceeds threshold", () => {
    const page = makePage();
    const bundle = makeBundle({
      connectors: { psi: makePsi({ cls: 0.3 }) },
    });
    const result = evalPRF004(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns not_applicable when no PSI data is available", () => {
    const page = makePage();
    const bundle = makeBundle({ connectors: {} });
    const result = evalPRF004(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass at exact CLS threshold boundary (0.1)", () => {
    const page = makePage();
    const bundle = makeBundle({
      connectors: { psi: makePsi({ cls: 0.1 }) },
    });
    const result = evalPRF004(page, bundle);
    expect(result.result).toBe("pass");
  });
});

// ─── SEC-001: Mixed content ──────────────────────────────────────────────────

describe("evalSEC001 - Mixed content", () => {
  it("returns not_applicable for non-HTTPS pages", () => {
    const page = makePage({ url: "http://example.com/", final_url: "http://example.com/" });
    const bundle = makeBundle();
    const result = evalSEC001(page, bundle);
    expect(result.result).toBe("not_applicable");
  });

  it("returns pass for HTTPS page with no HTTP links", () => {
    const page = makePage({
      url: "https://example.com/",
      links: [{ href: "https://example.com/about" }, { href: "https://cdn.example.com/style.css" }],
    });
    const bundle = makeBundle();
    const result = evalSEC001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail for HTTPS page with HTTP links (active mixed content)", () => {
    const page = makePage({
      url: "https://example.com/",
      links: [
        { href: "https://example.com/about" },
        { href: "http://insecure.example.com/script.js" },
      ],
    });
    const bundle = makeBundle();
    const result = evalSEC001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns fail when multiple HTTP resources are found", () => {
    const page = makePage({
      url: "https://example.com/",
      links: [{ href: "http://example.com/img.png" }, { href: "http://example.com/script.js" }],
    });
    const bundle = makeBundle();
    const result = evalSEC001(page, bundle);
    expect(result.result).toBe("fail");
  });
});

// ─── SEC-002: Security headers ───────────────────────────────────────────────

describe("evalSEC002 - Security headers", () => {
  it("returns not_applicable because response headers are not captured in evidence", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalSEC002(page, bundle);
    expect(result.result).toBe("not_applicable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── SEC-003: Broken resource load ───────────────────────────────────────────

describe("evalSEC003 - Broken resource load", () => {
  it("returns not_applicable because sub-resource load status is not captured in evidence", () => {
    const page = makePage();
    const bundle = makeBundle();
    const result = evalSEC003(page, bundle);
    expect(result.result).toBe("not_applicable");
    expect(result.rationale).toBeDefined();
  });
});

// ─── DEL-001: Rendered content parity ────────────────────────────────────────

describe("evalDEL001 - Rendered content parity", () => {
  it("returns pass when page rendered successfully with content", () => {
    const page = makePage({
      render: { rendered: true },
      main_content_bytes: 5000,
    });
    const bundle = makeBundle();
    const result = evalDEL001(page, bundle);
    expect(result.result).toBe("pass");
  });

  it("returns fail when page rendering failed", () => {
    const page = makePage({
      render: { rendered: false, render_reason: "JS_ERROR" },
      main_content_bytes: 0,
    });
    const bundle = makeBundle();
    const result = evalDEL001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
    expect(result.cap_trigger).toBe(true);
  });

  it("returns fail when main_content_bytes is 0 (empty main content)", () => {
    const page = makePage({
      render: { rendered: true },
      main_content_bytes: 0,
    });
    const bundle = makeBundle();
    const result = evalDEL001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.cap_trigger).toBe(true);
  });

  it("returns fail when rendering failed even if content bytes are present", () => {
    const page = makePage({
      render: { rendered: false, render_reason: "TIMEOUT" },
      main_content_bytes: 2000,
    });
    const bundle = makeBundle();
    const result = evalDEL001(page, bundle);
    expect(result.result).toBe("fail");
    expect(result.rationale).toBeDefined();
  });

  it("returns pass when rendered with minimal but non-zero content", () => {
    const page = makePage({
      render: { rendered: true },
      main_content_bytes: 100,
    });
    const bundle = makeBundle();
    const result = evalDEL001(page, bundle);
    expect(result.result).toBe("pass");
  });
});
