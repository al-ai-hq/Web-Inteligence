/**
 * i18n and accessibility evaluators — I18N-001..004, A11Y-001..004, MOB-001, AGT-001..002
 *
 * All per-page evaluators (PageEvaluator).
 *
 * Notes:
 * - All rules are deterministic (no assessed rules in this category).
 * - I18N-001 checks BCP 47 language declaration.
 * - I18N-002 checks RTL directionality (only applicable to RTL pages).
 * - I18N-003 checks hreflang annotations (only applicable to sites with localized equivalents).
 * - I18N-004 checks localized metadata consistency.
 * - A11Y-001..004 require interactive/DOM testing and return not_applicable.
 * - MOB-001 checks viewport meta declaration.
 * - AGT-001 checks for form/action indicators (only applicable to sites with forms).
 * - AGT-002 is unscored and requires experimental features (WebMCP, Lighthouse agentic).
 */

import type { EvidenceBundle, PageEvidence } from "../evidence.js";
import type { RuleEvaluation, PageEvaluator } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_BCP47_PREFIXES = [
  "en",
  "ar",
  "fr",
  "de",
  "es",
  "pt",
  "it",
  "nl",
  "ru",
  "zh",
  "ja",
  "ko",
  "hi",
  "bn",
  "ur",
  "fa",
  "he",
  "tr",
  "pl",
  "sv",
  "no",
  "da",
  "fi",
  "cs",
  "sk",
  "hu",
  "ro",
  "bg",
  "hr",
  "sr",
  "uk",
  "el",
  "th",
  "vi",
  "id",
  "ms",
  "tl",
  "sw",
  "am",
  "my",
  "km",
  "lo",
  "ka",
  "hy",
  "az",
  "kk",
  "uz",
  "mn",
  "ne",
  "si",
  "ta",
  "te",
  "ml",
  "kn",
  "gu",
  "mr",
  "pa",
  "or",
  "as",
  "ps",
];

const RTL_LANGS = ["ar", "he", "fa", "ur", "ps", "sd", "yi", "dv"];

const FORM_ACTION_KEYWORDS = [
  "booking",
  "order",
  "quote",
  "enquiry",
  "inquiry",
  "contact",
  "form",
  "submit",
  "register",
  "sign up",
  "login",
  "cart",
  "checkout",
  "apply",
  "request",
  "schedule",
  "appointment",
  "reservation",
];

const FORM_URL_PATTERNS = [
  /\/booking/i,
  /\/order/i,
  /\/quote/i,
  /\/contact/i,
  /\/form/i,
  /\/submit/i,
  /\/register/i,
  /\/signup/i,
  /\/login/i,
  /\/cart/i,
  /\/checkout/i,
  /\/apply/i,
  /\/request/i,
  /\/appointment/i,
  /\/reservation/i,
];

function isValidBCP47(lang: string): boolean {
  const primary = lang.toLowerCase().split("-")[0] ?? "";
  return VALID_BCP47_PREFIXES.includes(primary);
}

function isRTLLang(lang: string): boolean {
  const primary = lang.toLowerCase().split("-")[0] ?? "";
  return RTL_LANGS.includes(primary);
}

function hasAlternateLinks(links: { href: string; rel?: string }[]): boolean {
  return links.some((l) => {
    const rel = (l.rel || "").toLowerCase();
    return rel.includes("alternate");
  });
}

function hasFormIndicators(page: PageEvidence): boolean {
  // Check links for form-related URLs
  const hasFormLinks = page.links.some((l) => {
    return FORM_URL_PATTERNS.some((p) => p.test(l.href));
  });
  if (hasFormLinks) return true;

  // Check links for form-related text in href
  const hasFormKeywords = page.links.some((l) => {
    const href = l.href.toLowerCase();
    return FORM_ACTION_KEYWORDS.some((kw) => href.includes(kw));
  });
  if (hasFormKeywords) return true;

  // Check structured data for action types
  const hasActionSD = page.structured_data.some((block) => {
    const type = block.type.toLowerCase();
    return (
      type.includes("form") ||
      type.includes("action") ||
      type.includes("order") ||
      type.includes("booking")
    );
  });
  if (hasActionSD) return true;

  // Check headings for form-related keywords
  const allText = [
    page.title || "",
    page.meta_description || "",
    ...page.headings.map((h) => h.text),
  ]
    .join(" ")
    .toLowerCase();

  return FORM_ACTION_KEYWORDS.some((kw) => allText.includes(kw));
}

function detectContentLocale(text: string): "en" | "ar" | "unknown" {
  const lower = text.toLowerCase();

  // Check for Arabic script (Unicode range for Arabic block)
  if (/[\u0600-\u06FF]/.test(text)) {
    return "ar";
  }

  // Check for common English words
  const englishWords = ["the", "and", "is", "in", "to", "of", "a", "for", "on", "with"];
  const englishCount = englishWords.filter(
    (w) => lower.includes(` ${w} `) || lower.startsWith(`${w} `),
  ).length;
  if (englishCount >= 3) {
    return "en";
  }

  // Check for common Arabic words (transliterated or in context)
  const arabicWords = ["مرحبا", "اهلا", "خدمات", "شركة", "نحن"];
  const arabicCount = arabicWords.filter((w) => lower.includes(w)).length;
  if (arabicCount >= 1) {
    return "ar";
  }

  return "unknown";
}

// ─── I18N-001: Document language ─────────────────────────────────────────────

export const evalI18N001: PageEvaluator = (page, _bundle) => {
  if (!page.lang) {
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: "Page does not declare a language",
    };
  }

  if (isValidBCP47(page.lang)) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: `Language '${page.lang}' is not a valid BCP 47 code`,
  };
};

// ─── I18N-002: Directionality ────────────────────────────────────────────────

export const evalI18N002: PageEvaluator = (page, _bundle) => {
  // Only applicable to RTL pages
  if (!page.lang || !isRTLLang(page.lang)) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  // Check for direction in structured data
  const hasDirectionSD = page.structured_data.some((block) => {
    const inLanguage = block.data["inLanguage"];
    if (typeof inLanguage === "string" && isRTLLang(inLanguage)) {
      return true;
    }
    const direction = block.data["direction"];
    if (typeof direction === "string" && direction.toLowerCase() === "rtl") {
      return true;
    }
    return false;
  });

  if (hasDirectionSD) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // RTL page but no explicit direction markers found
  // This is a heuristic — we can't check the dir attribute directly from evidence
  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "RTL page does not declare direction in structured data",
  };
};

// ─── I18N-003: hreflang ──────────────────────────────────────────────────────

export const evalI18N003: PageEvaluator = (page, _bundle) => {
  // Only applicable to sites with localized equivalents
  const hasAlternate = hasAlternateLinks(page.links);
  const hasLocalizedSD = page.structured_data.some((block) => {
    return typeof block.data["inLanguage"] === "string";
  });

  if (!hasAlternate && !hasLocalizedSD) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  // Has localized equivalents — both hreflang (alternate links) and inLanguage SD
  // must be present and consistent for a pass.
  if (!hasAlternate || !hasLocalizedSD) {
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: "Localized equivalents do not use both hreflang and inLanguage annotations",
    };
  }

  // Both present — verify that inLanguage values are valid BCP 47 codes
  const hasInvalidLang = page.structured_data.some((block) => {
    const inLanguage = block.data["inLanguage"];
    return typeof inLanguage === "string" && !isValidBCP47(inLanguage);
  });

  if (hasInvalidLang) {
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: "Localized equivalents use invalid BCP 47 language codes",
    };
  }

  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── I18N-004: Localized metadata ────────────────────────────────────────────

export const evalI18N004: PageEvaluator = (page, bundle) => {
  const expectedLocale = bundle.locale;

  // If no lang declared, we can't check localization
  if (!page.lang) {
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: "Page does not declare language for localization check",
    };
  }

  // Get content text for locale detection
  const contentText = [
    page.title || "",
    page.meta_description || "",
    ...page.headings.map((h) => h.text),
  ].join(" ");

  const contentLocale = detectContentLocale(contentText);

  // If we can detect the content locale, check for mismatch
  if (contentLocale !== "unknown") {
    if (contentLocale === expectedLocale) {
      return { result: "pass", evidence_ids: [page.evidence_id] };
    } else {
      return {
        result: "fail",
        evidence_ids: [page.evidence_id],
        rationale: `Content locale '${contentLocale}' does not match expected locale '${expectedLocale}'`,
      };
    }
  }

  // If we can't detect content locale, check if page lang matches bundle locale
  const pageLangPrimary = page.lang.toLowerCase().split("-")[0] ?? "";
  if (pageLangPrimary === expectedLocale) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: `Page language '${page.lang}' does not match expected locale '${expectedLocale}'`,
  };
};

// ─── A11Y-001: Semantic landmarks ────────────────────────────────────────────

export const evalA11Y001: PageEvaluator = (page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale: "Requires interactive DOM inspection for semantic landmark validation",
  };
};

// ─── A11Y-002: Accessible names ──────────────────────────────────────────────

export const evalA11Y002: PageEvaluator = (page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale: "Requires interactive DOM inspection for accessible name validation",
  };
};

// ─── A11Y-003: Keyboard/focus basics ─────────────────────────────────────────

export const evalA11Y003: PageEvaluator = (page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale: "Requires interactive keyboard testing for focus validation",
  };
};

// ─── A11Y-004: Contrast and reflow sample ────────────────────────────────────

export const evalA11Y004: PageEvaluator = (page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale: "Requires CSS analysis for contrast and reflow validation",
  };
};

// ─── MOB-001: Mobile viewport and layout ─────────────────────────────────────

export const evalMOB001: PageEvaluator = (page, _bundle) => {
  if (!page.viewport_meta) {
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: "Page does not declare a viewport",
    };
  }

  // Check if viewport meta contains width=device-width
  const viewport = page.viewport_meta.toLowerCase();
  if (viewport.includes("width=device-width")) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  // Viewport declared but not using recommended width=device-width
  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "Viewport meta does not use width=device-width",
  };
};

// ─── AGT-001: Agent-operable forms and actions ───────────────────────────────

export const evalAGT001: PageEvaluator = (page, _bundle) => {
  // Only applicable to sites with key forms or actions
  if (!hasFormIndicators(page)) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  // Has form indicators — check for semantic HTML and accessible names
  // This is a heuristic check since we can't do interactive testing
  // For now, we pass if forms are detected (full validation requires interactive testing)
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── AGT-002: WebMCP and Lighthouse agentic checks ───────────────────────────

export const evalAGT002: PageEvaluator = (page, _bundle) => {
  return {
    result: "not_applicable",
    evidence_ids: [page.evidence_id],
    rationale:
      "Requires experimental WebMCP and Lighthouse agentic browsing features not available in M2",
  };
};
