/**
 * GEO (Generative Engine Optimization) evaluators — GEO-001 through GEO-011
 *
 * All per-page evaluators (PageEvaluator) except GEO-010 which is site-scope
 * but uses the PageEvaluator signature for uniformity (it reads bundle.site).
 *
 * Notes:
 * - GEO-005, GEO-007 are assessed rules and return `unavailable`.
 * - GEO-010 is report-only (unscored); absence of llms.txt is never a failure.
 * - GEO-011 requires business_profile_or_merchant_center data which is not
 *   available in M2, so it returns `not_applicable`.
 * - Deterministic rules use heuristic checks on headings, title, meta_description,
 *   structured data, and links to evaluate entity clarity and authority.
 */

import type { EvidenceBundle, PageEvidence } from "../evidence.js";
import type { RuleEvaluation, PageEvaluator } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ABOUT_KEYWORDS = [
  "about us", "about", "our story", "our history", "our mission", "our vision",
  "who we are", "our team", "founded", "established", "company", "organization",
];

const CONTACT_KEYWORDS = [
  "contact", "get in touch", "reach us", "our office", "location", "address",
  "phone", "email", "support", "help desk", "customer service",
];

const AUTHOR_PATTERNS = [
  /\bby\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/i,
  /\bauthor[s]?:\b/i,
  /\bwritten\s+by\b/i,
  /\breviewed\s+by\b/i,
  /\bedited\s+by\b/i,
  /\bcontributed\s+by\b/i,
];

const EDITORIAL_URL_PATTERNS = [
  /\/blog\//i,
  /\/article/i,
  /\/guide\//i,
  /\/tips/i,
  /\/advice/i,
  /\/how-to/i,
  /\/learn\//i,
  /\/resource/i,
];

const EDITORIAL_HEADING_KEYWORDS = [
  "guide", "tips", "how to", "tutorial", "review", "analysis", "advice",
  "expert", "best practices", "strategy", "introduction to", "complete guide",
];

const SOCIAL_PROFILE_PATTERNS = [
  /twitter\.com\//i,
  /x\.com\//i,
  /linkedin\.com\//i,
  /facebook\.com\//i,
  /instagram\.com\//i,
  /youtube\.com\//i,
  /github\.com\//i,
  /crunchbase\.com\//i,
  /wikipedia\.org\//i,
  /wikidata\.org\//i,
];

const AUTHORITATIVE_DOMAIN_PATTERNS = [
  /wikipedia\.org/i,
  /\.gov\b/i,
  /\.edu\b/i,
  /scholar\.google/i,
  /pubmed\.ncbi/i,
  /doi\.org/i,
  /arxiv\.org/i,
  /researchgate\.net/i,
  /who\.int/i,
  /un\.org/i,
  /statista\.com/i,
  /forbes\.com/i,
  /reuters\.com/i,
  /bbc\.com/i,
  /nytimes\.com/i,
];

const CREDENTIAL_KEYWORDS = [
  "certif", "accredit", "award", "honor", "recognition", "ISO", "badge",
  "licensed", "certified", "partner", "case study", "case studies",
  "testimonial", "portfolio", "client", "success stor",
];

const REPUTATION_SD_FIELDS = [
  "award", "aggregateRating", "review", "ratingValue", "reviewCount",
  "credentials", "certification",
];

function textContains(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
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

function hasExternalLinks(links: { href: string; rel?: string }[], pageUrl: string): { href: string; rel?: string }[] {
  let domain: string;
  try {
    domain = new URL(pageUrl).hostname;
  } catch {
    domain = "";
  }
  return links.filter((l) => {
    try {
      const linkDomain = new URL(l.href).hostname;
      return linkDomain !== domain && !l.href.startsWith("/") && !l.href.startsWith("#");
    } catch {
      return false;
    }
  });
}

function hasSocialProfileLink(links: { href: string; rel?: string }[]): boolean {
  return links.some((l) => hasPattern(l.href, SOCIAL_PROFILE_PATTERNS));
}

function hasSameAs(sd: { type: string; data: Record<string, unknown> }[]): boolean {
  return sd.some((block) => {
    const sameAs = block.data["sameAs"];
    if (Array.isArray(sameAs) && sameAs.length > 0) return true;
    if (typeof sameAs === "string" && sameAs.trim().length > 0) return true;
    return false;
  });
}

function isEditorialPage(page: PageEvidence): boolean {
  // Check URL pattern
  if (hasPattern(page.url, EDITORIAL_URL_PATTERNS)) return true;
  // Check headings for editorial keywords
  const allText = getAllText(page);
  if (textContains(allText, EDITORIAL_HEADING_KEYWORDS)) return true;
  return false;
}

function hasStructuredDataField(
  sd: { type: string; data: Record<string, unknown> }[],
  field: string,
): boolean {
  return sd.some((block) => {
    const val = block.data[field];
    if (val === undefined || val === null) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (typeof val === "object") return true;
    return false;
  });
}

// ─── GEO-001: Consistent entity name ─────────────────────────────────────────

export const evalGEO001: PageEvaluator = (page, bundle) => {
  const allText = getAllText(page);

  // Check if structured data has Organization/LocalBusiness name
  const sdNames: string[] = [];
  for (const block of page.structured_data) {
    const name = block.data["name"];
    if (typeof name === "string" && name.trim().length > 0) {
      sdNames.push(name.trim());
    }
  }

  // If we have structured data names, check consistency across pages
  if (sdNames.length > 0) {
    const primaryName = sdNames[0]!;
    const nameInTitle = page.title?.toLowerCase().includes(primaryName.toLowerCase()) ?? false;
    const nameInText = allText.toLowerCase().includes(primaryName.toLowerCase());

    if (nameInTitle || nameInText) {
      return { result: "pass", evidence_ids: [page.evidence_id] };
    }
  }

  // Check if entity name appears consistently in title + meta/headings
  // Extract potential entity name from title (first significant capitalized phrase)
  if (page.title && page.meta_description) {
    // Look for shared words between title and description (heuristic for entity name)
    const titleWords = new Set(page.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    const descWords = page.meta_description.toLowerCase().split(/\s+/);
    const sharedSignificant = descWords.filter(
      (w) => titleWords.has(w) && w.length > 3,
    );
    if (sharedSignificant.length >= 2) {
      return { result: "pass", evidence_ids: [page.evidence_id] };
    }
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No consistent entity name indicators found across page content and markup",
  };
};

// ─── GEO-002: About/entity page ──────────────────────────────────────────────

export const evalGEO002: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check if URL suggests an about page
  const isAboutUrl = /\/about/i.test(page.url) || /\/who-we-are/i.test(page.url);

  // Check for about-related content
  const hasAboutContent = textContains(allText, ABOUT_KEYWORDS);

  // Check for entity-focused structured data with description/history
  const hasEntitySD = page.structured_data.some((block) => {
    const entityType = ["Organization", "LocalBusiness", "Person", "Company"].includes(block.type);
    const hasDescription = typeof block.data["description"] === "string" && (block.data["description"] as string).trim().length > 0;
    const hasFounding = typeof block.data["foundingDate"] === "string";
    return entityType && (hasDescription || hasFounding);
  });

  if (isAboutUrl && hasAboutContent) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  if (hasEntitySD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  if (isAboutUrl) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "Page does not explain the organization, ownership, purpose, or history",
  };
};

// ─── GEO-003: Contact identity ───────────────────────────────────────────────

export const evalGEO003: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check for contact links
  if (hasContactLink(page.links)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check for contact-related headings
  if (textContains(allText, CONTACT_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check structured data for contact information
  const hasContactSD = page.structured_data.some((block) => {
    return (
      typeof block.data["telephone"] === "string" ||
      typeof block.data["email"] === "string" ||
      (typeof block.data["address"] === "object" && block.data["address"] !== null) ||
      (typeof block.data["contactPoint"] === "object" && block.data["contactPoint"] !== null)
    );
  });
  if (hasContactSD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No legitimate contact details or service location found",
  };
};

// ─── GEO-004: Author/editor identity ─────────────────────────────────────────

export const evalGEO004: PageEvaluator = (page, _bundle) => {
  // Check if this is editorial/advice content; if not, not_applicable
  if (!isEditorialPage(page)) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  const allText = getAllText(page);

  // Check for author structured data
  const hasAuthorSD = page.structured_data.some((block) => {
    const author = block.data["author"];
    if (typeof author === "object" && author !== null) return true;
    if (typeof author === "string" && author.trim().length > 0) return true;
    return false;
  });
  if (hasAuthorSD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check for author patterns in text (by X, written by, etc.)
  if (hasPattern(allText, AUTHOR_PATTERNS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "Editorial content does not identify responsible authors or reviewers",
  };
};

// ─── GEO-005: Evidence for claims (assessed) ─────────────────────────────────

export const evalGEO005: PageEvaluator = (_page, _bundle) => {
  return {
    result: "unavailable",
    evidence_ids: [],
    rationale: "Assessed rule — requires Auditor agent evaluation",
  };
};

// ─── GEO-006: Source quality ─────────────────────────────────────────────────

export const evalGEO006: PageEvaluator = (page, _bundle) => {
  const externalLinks = hasExternalLinks(page.links, page.url);

  // If no external links, not applicable (no citations to evaluate)
  if (externalLinks.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  // Check if any external links point to authoritative sources
  const hasAuthoritative = externalLinks.some((l) =>
    hasPattern(l.href, AUTHORITATIVE_DOMAIN_PATTERNS),
  );
  if (hasAuthoritative) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check if external links have rel attributes (indicating intentional citation)
  const hasRelLinks = externalLinks.some((l) => typeof l.rel === "string" && l.rel.length > 0);
  if (hasRelLinks && externalLinks.length > 0) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "External links do not point to recognized authoritative or primary sources",
  };
};

// ─── GEO-007: Non-commodity content (assessed) ───────────────────────────────

export const evalGEO007: PageEvaluator = (_page, _bundle) => {
  return {
    result: "unavailable",
    evidence_ids: [],
    rationale: "Assessed rule — requires Auditor agent evaluation",
  };
};

// ─── GEO-008: Entity connections ─────────────────────────────────────────────

export const evalGEO008: PageEvaluator = (page, _bundle) => {
  // Check for social profile links
  if (hasSocialProfileLink(page.links)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check for sameAs in structured data
  if (hasSameAs(page.structured_data)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "No official profiles or related entity connections found",
  };
};

// ─── GEO-009: Reputation signals on site ─────────────────────────────────────

export const evalGEO009: PageEvaluator = (page, _bundle) => {
  const allText = getAllText(page);

  // Check for credential/case evidence keywords
  if (textContains(allText, CREDENTIAL_KEYWORDS)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Check structured data for reputation fields
  const hasRepSD = page.structured_data.some((block) => {
    return REPUTATION_SD_FIELDS.some((field) => {
      const val = block.data[field];
      if (val === undefined || val === null) return false;
      if (typeof val === "string") return val.trim().length > 0;
      if (typeof val === "object") return true;
      return false;
    });
  });
  if (hasRepSD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // No reputation indicators — not_applicable (site may not show credentials)
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale: "No reputation signal indicators found; site may not display credentials or case evidence",
  };
};

// ─── GEO-010: Optional machine-readable summary (llms.txt) ───────────────────

export const evalGEO010: PageEvaluator = (page, bundle) => {
  const llmsTxt = bundle.site.llms_txt;

  // Absence is never a failure
  if (!llmsTxt || !llmsTxt.present) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  // File exists — check if it has valid references
  if (llmsTxt.references.length === 0) {
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: "llms.txt exists but contains no valid references (may point to dead pages)",
    };
  }

  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── GEO-011: Business Profile and Merchant Center consistency ───────────────

export const evalGEO011: PageEvaluator = (_page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [],
    rationale: "Requires business_profile_or_merchant_center data — not available in M2",
  };
};
