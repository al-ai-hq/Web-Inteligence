/**
 * Crawlability evaluators — CRW-001 through CRW-012
 *
 * Site-scope evaluators: CRW-001, CRW-002, CRW-003, CRW-004
 * Per-page evaluators: CRW-005 through CRW-012
 */

import type { EvidenceBundle, PageEvidence } from "../evidence.js";
import type { RuleEvaluation, Evaluator, PageEvaluator } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function is2xx(status: number): boolean {
  return status >= 200 && status < 300;
}

function isAbsoluteUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isCrawlableLink(href: string): boolean {
  if (!href || href === "#") return false;
  if (href.startsWith("javascript:")) return false;
  return true;
}

// ─── CRW-001: Homepage reachable (site-scope) ─────────────────────────────────

export const evalCRW001: Evaluator = (bundle) => {
  const hp = bundle.site.homepage;
  if (!hp) {
    return { result: "fail", evidence_ids: ["site.homepage"], cap_trigger: true };
  }
  if (!is2xx(hp.status_code)) {
    return {
      result: "fail",
      evidence_ids: [hp.evidence_id],
      cap_trigger: true,
    };
  }
  return { result: "pass", evidence_ids: [hp.evidence_id] };
};

// ─── CRW-002: Important pages reachable (site-scope) ──────────────────────────

export const evalCRW002: Evaluator = (bundle) => {
  const pages = bundle.pages;
  if (pages.length === 0) {
    return { result: "unavailable", evidence_ids: [] };
  }
  const ok = pages.filter((p) => is2xx(p.status_code)).length;
  const ratio = ok / pages.length;
  if (ratio >= 0.9) {
    return { result: "pass", evidence_ids: pages.map((p) => p.evidence_id) };
  }
  return { result: "fail", evidence_ids: pages.map((p) => p.evidence_id) };
};

// ─── CRW-003: Site-wide indexability (site-scope) ─────────────────────────────

export const evalCRW003: Evaluator = (bundle) => {
  const pages = bundle.pages;
  if (pages.length === 0) {
    return { result: "unavailable", evidence_ids: [] };
  }
  const blocked = pages.filter(
    (p) => p.robots_directive === "noindex" || p.robots_directive === "none",
  );
  const ratio = blocked.length / pages.length;
  if (ratio === 0) {
    return { result: "pass", evidence_ids: pages.map((p) => p.evidence_id) };
  }
  if (ratio >= 0.5) {
    return {
      result: "fail",
      evidence_ids: blocked.map((p) => p.evidence_id),
      cap_trigger: true,
    };
  }
  return {
    result: "partial",
    evidence_ids: blocked.map((p) => p.evidence_id),
  };
};

// ─── CRW-004: robots.txt availability and syntax (site-scope) ─────────────────

export const evalCRW004: Evaluator = (bundle) => {
  const robots = bundle.site.robots;
  if (!robots.fetched) {
    return { result: "fail", evidence_ids: ["site.robots"] };
  }
  // Check for general block: Disallow: / for wildcard agent
  const hasGeneralBlock = robots.directives.some(
    (d) =>
      d.user_agent === "*" &&
      d.disallow.some((pattern) => pattern === "/"),
  );
  if (hasGeneralBlock) {
    return {
      result: "fail",
      evidence_ids: ["site.robots"],
      cap_trigger: true,
    };
  }
  return { result: "pass", evidence_ids: ["site.robots"] };
};

// ─── CRW-005: XML sitemap (per-page) ──────────────────────────────────────────

export const evalCRW005: PageEvaluator = (page, bundle) => {
  if (bundle.site.sitemap.present) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  return { result: "fail", evidence_ids: [page.evidence_id] };
};

// ─── CRW-006: Canonical consistency (per-page) ────────────────────────────────

export const evalCRW006: PageEvaluator = (page, _bundle) => {
  if (!page.canonical) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  if (!isAbsoluteUrl(page.canonical)) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  // Exact match
  if (page.canonical === page.final_url) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  try {
    const canonUrl = new URL(page.canonical);
    const finalUrl = new URL(page.final_url);
    // Normalize hosts by stripping www prefix for comparison
    const normalizeHost = (h: string) => h.replace(/^www\./, "");
    const sameHost = normalizeHost(canonUrl.host) === normalizeHost(finalUrl.host);
    if (sameHost && canonUrl.pathname === finalUrl.pathname) {
      // Same page, minor difference (scheme, port, trailing slash, www) → partial
      return { result: "partial", evidence_ids: [page.evidence_id] };
    }
    if (sameHost && canonUrl.pathname !== finalUrl.pathname) {
      // Same site but different page → fail
      return { result: "fail", evidence_ids: [page.evidence_id] };
    }
  } catch {
    // fall through
  }
  // Different origin entirely → fail
  return { result: "fail", evidence_ids: [page.evidence_id] };
};

// ─── CRW-007: Redirect health (per-page) ──────────────────────────────────────

export const evalCRW007: PageEvaluator = (page, _bundle) => {
  // Page itself is a redirect (3xx status)
  if (page.status_code >= 300 && page.status_code < 400) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  // Error status
  if (page.status_code >= 400) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  // Redirect occurred (url differs from final_url) but resolved OK
  if (page.url !== page.final_url) {
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── CRW-008: Crawlable internal links (per-page) ─────────────────────────────

export const evalCRW008: PageEvaluator = (page, _bundle) => {
  if (page.links.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }
  const crawlable = page.links.filter((l) => isCrawlableLink(l.href)).length;
  const total = page.links.length;
  if (crawlable === total) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  if (crawlable === 0) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  return { result: "partial", evidence_ids: [page.evidence_id] };
};

// ─── CRW-009: Status-code integrity (per-page) ────────────────────────────────

export const evalCRW009: PageEvaluator = (page, _bundle) => {
  // Hard error codes
  if (page.status_code === 404 || page.status_code === 410 || page.status_code >= 500) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  // Soft 404: 200 status but no content
  if (is2xx(page.status_code) && page.word_count === 0 && page.main_content_bytes === 0) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── CRW-010: AI/search bot policy visibility (per-page) ──────────────────────

export const evalCRW010: PageEvaluator = (page, _bundle) => {
  if (page.robots_directive === "index") {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  // noindex or none → not visible to bots
  return { result: "fail", evidence_ids: [page.evidence_id] };
};

// ─── CRW-011: Agent parity (per-page) ─────────────────────────────────────────
// Assessed rule — requires multi-agent crawl data not available in M2 evidence.

export const evalCRW011: PageEvaluator = (_page, _bundle) => {
  return {
    result: "unavailable",
    evidence_ids: [],
    rationale: "assessed_pending_agent: requires multi-agent crawl comparison",
  };
};

// ─── CRW-012: Snippet eligibility (per-page) ──────────────────────────────────

export const evalCRW012: PageEvaluator = (page, _bundle) => {
  // Must be indexable
  if (page.robots_directive !== "index") {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  // Must have title and meta description for snippet
  if (!page.title || !page.meta_description) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};
