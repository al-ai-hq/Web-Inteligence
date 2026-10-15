/**
 * AEO (Answer Engine Optimization) evaluators — AEO-001 through AEO-011
 *
 * All per-page evaluators (PageEvaluator).
 *
 * Notes:
 * - AEO-001, AEO-006, AEO-009 are assessed rules and return `unavailable`.
 * - Deterministic rules use heuristic checks on headings, title, meta_description,
 *   structured data, and links to evaluate content quality for answer engines.
 */

import type { EvidenceBundle, PageEvidence } from "../evidence.js";
import type { RuleEvaluation, PageEvaluator } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUDIENCE_KEYWORDS = [
  "businesses",
  "business",
  "developers",
  "developer",
  "homeowners",
  "homeowner",
  "teams",
  "team",
  "freelancers",
  "freelancer",
  "agencies",
  "agency",
  "professionals",
  "professional",
  "students",
  "student",
  "teachers",
  "teacher",
  "engineers",
  "engineer",
  "designers",
  "designer",
  "marketers",
  "marketer",
  "founders",
  "founder",
  "executives",
  "executive",
  "managers",
  "manager",
  "creators",
  "creator",
  "for you",
  "for your",
];

const GEO_KEYWORDS = [
  "worldwide",
  "global",
  "international",
  "nationwide",
  "local",
  "near me",
  "available in",
  "serves",
  "serving",
  "area",
  "region",
];

const LOCATION_PATTERNS = [
  /\b(?:USA|US|UK|UAE|KSA|Saudi Arabia|United States|United Kingdom)\b/i,
  /\b(?:California|Texas|New York|London|Berlin|Paris|Dubai|Riyadh|Jeddah)\b/i,
  /\b(?:North America|Europe|Asia|Middle East|Africa|Australia)\b/i,
];

const PRICING_KEYWORDS = [
  "pricing",
  "price",
  "cost",
  "plans",
  "plan",
  "subscription",
  "free",
  "premium",
  "enterprise",
  "quote",
  "estimate",
  "budget",
  "affordable",
  "expensive",
  "cheap",
  "starting at",
  "per month",
  "per year",
  "monthly",
  "yearly",
];

const PRICING_PATTERNS = [/\$[\d,]+(?:\.\d{2})?/, /\b\d+(?:\.\d{2})?\s*(?:USD|EUR|GBP|SAR|AED)\b/i];

const PROCESS_KEYWORDS = [
  "how it works",
  "process",
  "steps",
  "guide",
  "tutorial",
  "getting started",
  "get started",
  "begin",
  "workflow",
  "methodology",
  "approach",
  "phase",
  "step 1",
  "step 2",
  "step 3",
  "first",
  "second",
  "third",
  "finally",
];

const COMPARISON_KEYWORDS = [
  "vs",
  "versus",
  "compare",
  "comparison",
  "difference",
  "better",
  "worse",
  "best",
  "worst",
  "top",
  "choose",
  "which",
  "suitable",
  "trade-off",
  "tradeoff",
  "pros and cons",
  "advantages",
  "disadvantages",
  "features",
];

const FAQ_KEYWORDS = ["faq", "frequently asked", "common questions", "questions", "q&a", "qa"];

const QUESTION_PATTERN = /\b(?:what|how|why|when|where|who|which|can|do|does|is|are)\b.*\?/i;

const FRESHNESS_KEYWORDS = [
  "updated",
  "update",
  "latest",
  "new",
  "recent",
  "current",
  "modified",
  "published",
  "posted",
  "released",
  "version",
  "changelog",
  "news",
];

const DATE_PATTERNS = [
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}\b/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i,
];

const CTA_KEYWORDS = [
  "contact",
  "get started",
  "sign up",
  "subscribe",
  "buy now",
  "order",
  "request",
  "quote",
  "demo",
  "trial",
  "call us",
  "email",
  "reach out",
  "learn more",
  "start",
  "begin",
  "join",
];

function textContains(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function headingsContain(headings: { level: number; text: string }[], keywords: string[]): boolean {
  return headings.some((h) => textContains(h.text, keywords));
}

function hasPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function getAllText(page: PageEvidence): string {
  const parts = [
    page.title || "",
    page.meta_description || "",
    ...page.headings.map((h) => h.text),
  ];
  return parts.join(" ");
}

function hasContactLink(links: { href: string; rel?: string }[]): boolean {
  return links.some((l) => {
    const href = l.href.toLowerCase();
    return href.startsWith("mailto:") || href.startsWith("tel:") || href.includes("contact");
  });
}

function hasStructuredDataField(
  sd: { type: string; data: Record<string, unknown> }[],
  field: string,
): boolean {
  return sd.some((block) => {
    const val = block.data[field];
    return typeof val === "string" && val.trim().length > 0;
  });
}

// ─── AEO-001: Clear offering (assessed) ──────────────────────────────────────

export const evalAEO001: PageEvaluator = (_page, _bundle) => {
  return {
    result: "unavailable",
    evidence_ids: [],
    rationale: "Assessed rule — requires Auditor agent evaluation",
  };
};

// ─── AEO-002: Audience clarity ───────────────────────────────────────────────

export const evalAEO002: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);
  if (textContains(allText, AUDIENCE_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No audience-identifying keywords found in page content",
  };
};

// ─── AEO-003: Geographic availability ────────────────────────────────────────

export const evalAEO003: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check for geographic keywords
  if (textContains(allText, GEO_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check for location patterns
  if (hasPattern(allText, LOCATION_PATTERNS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check structured data for areaServed or address
  const hasGeoSD = page.structured_data.some((block) => {
    return (
      typeof block.data["areaServed"] === "string" ||
      (typeof block.data["address"] === "object" && block.data["address"] !== null) ||
      (typeof block.data["location"] === "object" && block.data["location"] !== null)
    );
  });
  if (hasGeoSD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No geographic availability indicators found",
  };
};

// ─── AEO-004: Pricing or pricing explanation ─────────────────────────────────

export const evalAEO004: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check for pricing keywords
  if (textContains(allText, PRICING_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check for price patterns (currency symbols, amounts)
  if (hasPattern(allText, PRICING_PATTERNS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check structured data for price fields
  const hasPriceSD = page.structured_data.some((block) => {
    return (
      typeof block.data["price"] === "string" ||
      typeof block.data["priceRange"] === "string" ||
      (typeof block.data["offers"] === "object" && block.data["offers"] !== null)
    );
  });
  if (hasPriceSD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No pricing information found",
  };
};

// ─── AEO-005: Process explanation ────────────────────────────────────────────

export const evalAEO005: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check for process-related keywords
  if (textContains(allText, PROCESS_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No process explanation found in page content",
  };
};

// ─── AEO-006: Direct question answers (assessed) ─────────────────────────────

export const evalAEO006: PageEvaluator = (_page, _bundle) => {
  return {
    result: "unavailable",
    evidence_ids: [],
    rationale: "Assessed rule — requires Auditor agent evaluation",
  };
};

// ─── AEO-007: FAQ quality ────────────────────────────────────────────────────

export const evalAEO007: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check if page has any FAQ-like content
  const hasFAQKeywords = textContains(allText, FAQ_KEYWORDS);
  const hasQuestions = page.headings.some((h) => QUESTION_PATTERN.test(h.text));
  const hasFAQPage = page.structured_data.some((b) => b.type === "FAQPage");

  // If no FAQ indicators at all, not applicable
  if (!hasFAQKeywords && !hasQuestions && !hasFAQPage) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  // Has FAQ content — check if it's useful (has multiple questions or structured data)
  const questionCount = page.headings.filter((h) => QUESTION_PATTERN.test(h.text)).length;
  if (hasFAQPage || questionCount >= 2 || hasFAQKeywords) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "FAQ content is present but not sufficiently useful",
  };
};

// ─── AEO-008: Comparison and selection guidance ──────────────────────────────

export const evalAEO008: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  if (textContains(allText, COMPARISON_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No comparison or selection guidance found",
  };
};

// ─── AEO-009: Reader-first organization (assessed) ───────────────────────────

export const evalAEO009: PageEvaluator = (_page, _bundle) => {
  return {
    result: "unavailable",
    evidence_ids: [],
    rationale: "Assessed rule — requires Auditor agent evaluation",
  };
};

// ─── AEO-010: Content freshness ──────────────────────────────────────────────

export const evalAEO010: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check for freshness keywords
  if (textContains(allText, FRESHNESS_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check for date patterns
  if (hasPattern(allText, DATE_PATTERNS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check structured data for date fields
  const hasDateSD =
    hasStructuredDataField(page.structured_data, "dateModified") ||
    hasStructuredDataField(page.structured_data, "datePublished") ||
    hasStructuredDataField(page.structured_data, "lastReviewed");
  if (hasDateSD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No content freshness indicators found",
  };
};

// ─── AEO-011: Contact and next-step clarity ──────────────────────────────────

export const evalAEO011: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check for CTA keywords
  if (textContains(allText, CTA_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check for contact links
  if (hasContactLink(page.links)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check structured data for contactPoint
  const hasContactSD = page.structured_data.some((block) => {
    return typeof block.data["contactPoint"] === "object" && block.data["contactPoint"] !== null;
  });
  if (hasContactSD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No contact information or clear next-step found",
  };
};
