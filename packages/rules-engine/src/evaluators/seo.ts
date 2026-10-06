/**
 * On-page SEO evaluators — SEO-001 through SEO-012, plus SPAM-001
 *
 * Per-page evaluators: SEO-001 through SEO-012
 * Site-scope evaluator: SPAM-001
 */

import type { EvidenceBundle, PageEvidence } from "../evidence.js";
import type { RuleEvaluation, Evaluator, PageEvaluator } from "../types.js";
import { wordOverlap } from "./helpers.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isInternalLink(href: string, rootUrl: string): boolean {
  try {
    const linkUrl = new URL(href);
    const root = new URL(rootUrl);
    return linkUrl.origin === root.origin;
  } catch {
    // Relative URLs are internal
    return href.startsWith("/") || (!href.includes("://") && href !== "#" && !href.startsWith("javascript:"));
  }
}

function isDescriptiveHref(href: string): boolean {
  // Generic patterns that are not descriptive
  const genericPatterns = [
    /^.*[?&]id=\d+/,       // query param IDs
    /^.*\/click\b/,        // generic "click" paths
    /^.*\/page\/\d+$/,     // numeric page paths
    /^#$/,                  // hash only
    /^javascript:/,         // javascript links
  ];
  return !genericPatterns.some((p) => p.test(href));
}

// ─── SEO-001: Unique page title (per-page) ───────────────────────────────────

export const evalSEO001: PageEvaluator = (page, _bundle) => {
  if (!page.title || page.title.trim() === "") {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  if (page.title.trim().length < 10) {
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── SEO-002: Meta description (per-page) ────────────────────────────────────

export const evalSEO002: PageEvaluator = (page, _bundle) => {
  if (!page.meta_description || page.meta_description.trim() === "") {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  if (page.meta_description.trim().length < 20) {
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── SEO-003: Single descriptive H1 (per-page) ───────────────────────────────

export const evalSEO003: PageEvaluator = (page, _bundle) => {
  const h1s = page.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  if (h1s.length > 1) {
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── SEO-004: Heading hierarchy (per-page) ───────────────────────────────────

export const evalSEO004: PageEvaluator = (page, _bundle) => {
  if (page.headings.length === 0) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  // Check if first heading starts at H1
  const firstHeading = page.headings[0]!;
  if (firstHeading.level > 1) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  // Check for skips in hierarchy
  let hasSkip = false;
  for (let i = 1; i < page.headings.length; i++) {
    const prev = page.headings[i - 1]!.level;
    const curr = page.headings[i]!.level;
    // A skip is when we go deeper by more than 1 level
    if (curr > prev + 1) {
      hasSkip = true;
      break;
    }
  }
  if (hasSkip) {
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── SEO-005: Internal linking (per-page) ────────────────────────────────────

export const evalSEO005: PageEvaluator = (page, bundle) => {
  if (page.links.length === 0) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  const internalLinks = page.links.filter((l) => isInternalLink(l.href, bundle.site.root_url));
  if (internalLinks.length === 0) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  if (internalLinks.length === 1) {
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── SEO-006: Descriptive anchors (per-page) ─────────────────────────────────

export const evalSEO006: PageEvaluator = (page, _bundle) => {
  if (page.links.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }
  const descriptive = page.links.filter((l) => isDescriptiveHref(l.href));
  const ratio = descriptive.length / page.links.length;
  if (ratio >= 0.7) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  if (ratio >= 0.3) {
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  return { result: "fail", evidence_ids: [page.evidence_id] };
};

// ─── SEO-007: Image alternatives (per-page) ──────────────────────────────────
// M2 evidence model does not include image data; cannot evaluate.

export const evalSEO007: PageEvaluator = (_page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [],
    rationale: "M2 evidence model does not include image/alt-text data",
  };
};

// ─── SEO-008: Duplicate content indicators (per-page) ────────────────────────

export const evalSEO008: PageEvaluator = (page, bundle) => {
  const duplicates = bundle.pages.filter(
    (p) => p.evidence_id !== page.evidence_id && p.content_hash === page.content_hash,
  );
  if (duplicates.length > 0) {
    return {
      result: "fail",
      evidence_ids: [page.evidence_id, ...duplicates.map((d) => d.evidence_id)],
    };
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── SEO-009: Metadata consistency (per-page) ────────────────────────────────

export const evalSEO009: PageEvaluator = (page, _bundle) => {
  if (!page.title || page.title.trim() === "") {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  const h1s = page.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    // Title exists but no H1 to compare — partial consistency
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  const h1Text = h1s[0]!.text;
  const desc = page.meta_description || "";
  // Check overlap between title and H1
  const titleH1Overlap = wordOverlap(page.title, h1Text);
  // If title and H1 are completely unrelated, fail
  if (titleH1Overlap < 0.15 && page.title.length > 5 && h1Text.length > 5) {
    return { result: "fail", evidence_ids: [page.evidence_id] };
  }
  // Check if description is also related
  if (desc.length > 0) {
    const titleDescOverlap = wordOverlap(page.title, desc);
    if (titleDescOverlap < 0.1 && titleH1Overlap < 0.3) {
      return { result: "fail", evidence_ids: [page.evidence_id] };
    }
  }
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── SEO-010: Open Graph/social metadata (per-page) ─────────────────────────
// M2 evidence model does not include OG/social metadata; cannot evaluate.

export const evalSEO010: PageEvaluator = (_page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [],
    rationale: "M2 evidence model does not include Open Graph/social metadata",
  };
};

// ─── SEO-011: Keyword cluster mapped to one page (per-page) ──────────────────
// Requires keyword_data, unavailable in M2.

export const evalSEO011: PageEvaluator = (_page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [],
    rationale: "requires_data: keyword_data, unavailable in M2",
  };
};

// ─── SEO-012: No split cluster / cannibalization (per-page) ──────────────────
// Requires keyword_data, unavailable in M2.

export const evalSEO012: PageEvaluator = (_page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [],
    rationale: "requires_data: keyword_data, unavailable in M2",
  };
};

// ─── SPAM-001: Spam-policy screen (site-scope) ──────────────────────────────
// Unscored; emits fail + cap_trigger when spam patterns detected.
// Heuristics for M2:
//   - Hidden text / thin pages: pages with very low word_count (<10) but high
//     main_content_bytes ratio (>80% of expected). Need >=2 such pages to trigger
//     (scaled/templated pattern).
//   - Doorway pages: near-duplicate clusters based on content_hash. A cluster of
//     >=3 pages with the same content_hash triggers doorway detection.

export const evalSPAM001: Evaluator = (bundle) => {
  const pages = bundle.pages;
  if (pages.length === 0) {
    return { result: "pass", evidence_ids: [] };
  }

  // --- Thin page detection (hidden text heuristic) ---
  // Pages with very low word count but substantial main_content_bytes suggest
  // text is hidden via CSS tricks (e.g., display:none, visibility:hidden, or
  // same-color-as-background text).
  const thinPages = pages.filter(
    (p) => p.word_count < 10 && p.main_content_bytes > 1000,
  );
  // Need at least 2 thin pages to indicate "scaled" pattern
  if (thinPages.length >= 2) {
    return {
      result: "fail",
      evidence_ids: thinPages.map((p) => p.evidence_id),
      rationale: `Detected ${thinPages.length} thin pages with low word count but high content bytes (possible hidden text)`,
      cap_trigger: true,
    };
  }

  // --- Doorway page detection (near-duplicate clusters) ---
  // Group pages by content_hash; a cluster of >=3 identical pages suggests
  // doorway/templated spam.
  const hashGroups = new Map<string, PageEvidence[]>();
  for (const p of pages) {
    const group = hashGroups.get(p.content_hash) || [];
    group.push(p);
    hashGroups.set(p.content_hash, group);
  }
  for (const [, group] of hashGroups) {
    if (group.length >= 3) {
      return {
        result: "fail",
        evidence_ids: group.map((p) => p.evidence_id),
        rationale: `Doorway pattern: ${group.length} pages share identical content_hash`,
        cap_trigger: true,
      };
    }
  }

  return { result: "pass", evidence_ids: pages.map((p) => p.evidence_id) };
};
