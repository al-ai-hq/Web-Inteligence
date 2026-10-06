/**
 * Structured data evaluators — STR-001 through STR-008
 *
 * All per-page evaluators (PageEvaluator).
 *
 * Notes:
 * - STR-003 and STR-004 return `unavailable` because schema-requirements.yaml
 *   has to_verify_at_m0b: true for all types with empty property lists.
 * - Entity types checked by STR-002/STR-006: Organization, LocalBusiness, Service.
 * - Spam types checked by STR-008: Review, AggregateRating.
 */

import type { EvidenceBundle, PageEvidence, JsonLdBlock } from "../evidence.js";
import type { RuleEvaluation, PageEvaluator } from "../types.js";
import { wordOverlap } from "./helpers.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ENTITY_TYPES = new Set(["Organization", "LocalBusiness", "Service"]);
const SPAM_TYPES = new Set(["Review", "AggregateRating"]);

/** Types where we check name/headline consistency with visible content */
const CONSISTENCY_CHECK_TYPES: Record<string, string[]> = {
  Organization: ["name"],
  LocalBusiness: ["name"],
  Article: ["headline"],
};

function findEntityBlocks(sd: JsonLdBlock[]): JsonLdBlock[] {
  return sd.filter((b) => ENTITY_TYPES.has(b.type));
}

/**
 * Check whether a page URL indicates a deep/hierarchical path
 * (more than 2 path segments beyond the root).
 */
function isDeepPath(url: string): boolean {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter((s) => s.length > 0);
    return segments.length >= 2;
  } catch {
    return false;
  }
}

// ─── STR-001: Parseable structured data (per-page) ───────────────────────────

export const evalSTR001: PageEvaluator = (page, _bundle) => {
  if (page.structured_data.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }
  // If structured_data is non-empty, it was already parsed successfully from JSON-LD.
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── STR-002: Appropriate organization/entity type (per-page) ────────────────

export const evalSTR002: PageEvaluator = (page, _bundle) => {
  if (page.structured_data.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }
  const entities = findEntityBlocks(page.structured_data);
  if (entities.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }
  // Check that every entity block has a name property
  const allHaveName = entities.every(
    (e) => typeof e.data["name"] === "string" && (e.data["name"] as string).trim().length > 0,
  );
  if (allHaveName) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "Entity type structured data is missing the 'name' property",
  };
};

// ─── STR-003: Required properties (per-page) ─────────────────────────────────
// schema-requirements.yaml has to_verify_at_m0b: true for all types.
// Until verified, this rule returns unavailable (per the YAML notes).

export const evalSTR003: PageEvaluator = (page, _bundle) => {
  if (page.structured_data.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }
  return {
    result: "unavailable",
    evidence_ids: [page.evidence_id],
    rationale: "Required-property lists are to_verify_at_m0b in config/schema-requirements.yaml",
  };
};

// ─── STR-004: Recommended factual properties (per-page) ──────────────────────
// Same situation as STR-003 — recommended lists are empty pending M0B verification.

export const evalSTR004: PageEvaluator = (page, _bundle) => {
  if (page.structured_data.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }
  return {
    result: "unavailable",
    evidence_ids: [page.evidence_id],
    rationale: "Recommended-property lists are to_verify_at_m0b in config/schema-requirements.yaml",
  };
};

// ─── STR-005: Visible-content consistency (per-page) ─────────────────────────

export const evalSTR005: PageEvaluator = (page, _bundle) => {
  if (page.structured_data.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  // Check each block that has consistency rules
  const blocksToCheck = page.structured_data.filter((b) => b.type in CONSISTENCY_CHECK_TYPES);
  if (blocksToCheck.length === 0) {
    // Types without specific consistency checks (e.g. BreadcrumbList) pass by default
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }

  const h1Text = page.headings.find((h) => h.level === 1)?.text ?? "";
  const titleText = page.title ?? "";

  for (const block of blocksToCheck) {
    const fieldsToCheck = CONSISTENCY_CHECK_TYPES[block.type];
    if (!fieldsToCheck) continue;
    for (const field of fieldsToCheck) {
      const sdValue = block.data[field];
      if (typeof sdValue !== "string" || sdValue.trim().length === 0) continue;

      // Compare against visible content
      let hasOverlap = false;

      // For headline fields, compare with H1
      if (field === "headline" && h1Text.length > 0) {
        hasOverlap = wordOverlap(sdValue, h1Text) >= 0.3;
      }
      // For name fields, compare with title
      if (field === "name" && titleText.length > 0) {
        hasOverlap = wordOverlap(sdValue, titleText) >= 0.3;
      }
      // Also try headline field against title
      if (field === "headline" && titleText.length > 0 && !hasOverlap) {
        hasOverlap = wordOverlap(sdValue, titleText) >= 0.3;
      }
      // Also try name against H1
      if (field === "name" && h1Text.length > 0 && !hasOverlap) {
        hasOverlap = wordOverlap(sdValue, h1Text) >= 0.3;
      }

      if (!hasOverlap && (titleText.length > 0 || h1Text.length > 0)) {
        return {
          result: "fail",
          evidence_ids: [page.evidence_id],
          rationale: `Structured data '${block.type}.${field}' does not match visible page content`,
        };
      }
    }
  }

  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── STR-006: Stable entity identifiers (per-page) ───────────────────────────

export const evalSTR006: PageEvaluator = (page, bundle) => {
  if (page.structured_data.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }
  const entities = findEntityBlocks(page.structured_data);
  if (entities.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  // Check cross-page consistency for entities with @id
  for (const entity of entities) {
    const entityId = entity.data["@id"];
    if (typeof entityId === "string" && entityId.length > 0) {
      // Find same @id on other pages
      for (const otherPage of bundle.pages) {
        if (otherPage.evidence_id === page.evidence_id) continue;
        for (const otherBlock of otherPage.structured_data) {
          if (otherBlock.data["@id"] === entityId && ENTITY_TYPES.has(otherBlock.type)) {
            // Check name consistency
            if (
              typeof entity.data["name"] === "string" &&
              typeof otherBlock.data["name"] === "string" &&
              entity.data["name"] !== otherBlock.data["name"]
            ) {
              return {
                result: "fail",
                evidence_ids: [page.evidence_id, otherPage.evidence_id],
                rationale: `Entity @id '${entityId}' has inconsistent name across pages`,
              };
            }
          }
        }
      }
    }
  }

  // Check identifier completeness for each entity
  const identifierProps = ["@id", "url", "name", "logo"];
  let bestScore = 0;

  for (const entity of entities) {
    const present = identifierProps.filter(
      (p) => typeof entity.data[p] === "string" && (entity.data[p] as string).trim().length > 0,
    ).length;
    if (present > bestScore) bestScore = present;
  }

  if (bestScore >= 3) {
    return { result: "pass", evidence_ids: [page.evidence_id] };
  }
  if (bestScore === 2) {
    return { result: "partial", evidence_ids: [page.evidence_id] };
  }
  return {
    result: "fail",
    evidence_ids: [page.evidence_id],
    rationale: "Entity structured data is missing stable identifiers (@id, url, name, logo)",
  };
};

// ─── STR-007: Breadcrumb markup (per-page) ───────────────────────────────────

export const evalSTR007: PageEvaluator = (page, _bundle) => {
  if (page.structured_data.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  const breadcrumbBlock = page.structured_data.find((b) => b.type === "BreadcrumbList");

  if (breadcrumbBlock) {
    const items = breadcrumbBlock.data["itemListElement"];
    if (Array.isArray(items) && items.length > 0) {
      return { result: "pass", evidence_ids: [page.evidence_id] };
    }
    // BreadcrumbList present but empty or missing itemListElement
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: "BreadcrumbList is present but itemListElement is missing or empty",
    };
  }

  // No BreadcrumbList — check if the page has a deep path where breadcrumbs are useful
  if (isDeepPath(page.url)) {
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: "Page has a deep URL path but no BreadcrumbList structured data",
    };
  }

  // Shallow path, breadcrumbs not needed
  return { result: "pass", evidence_ids: [page.evidence_id] };
};

// ─── STR-008: Unsupported/spam markup (per-page) ─────────────────────────────

export const evalSTR008: PageEvaluator = (page, _bundle) => {
  if (page.structured_data.length === 0) {
    return { result: "not_applicable", evidence_ids: [page.evidence_id] };
  }

  const spamBlocks = page.structured_data.filter((b) => SPAM_TYPES.has(b.type));
  if (spamBlocks.length > 0) {
    const types = spamBlocks.map((b) => b.type).join(", ");
    return {
      result: "fail",
      evidence_ids: [page.evidence_id],
      rationale: `Page contains fabrication-prone structured data types: ${types}`,
    };
  }

  return { result: "pass", evidence_ids: [page.evidence_id] };
};
