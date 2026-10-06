/**
 * Evaluator registry — maps rule IDs to evaluator functions and scope.
 *
 * Site-scope evaluators (Evaluator): operate on the full EvidenceBundle.
 * Page-scope evaluators (PageEvaluator): operate on a single PageEvidence + bundle.
 */

import type { Evaluator, PageEvaluator } from "../types.js";

import { evalCRW001, evalCRW002, evalCRW003, evalCRW004, evalCRW005, evalCRW006, evalCRW007, evalCRW008, evalCRW009, evalCRW010, evalCRW011, evalCRW012 } from "./crawl.js";
import { evalSEO001, evalSEO002, evalSEO003, evalSEO004, evalSEO005, evalSEO006, evalSEO007, evalSEO008, evalSEO009, evalSEO010, evalSEO011, evalSEO012, evalSPAM001 } from "./seo.js";
import { evalSTR001, evalSTR002, evalSTR003, evalSTR004, evalSTR005, evalSTR006, evalSTR007, evalSTR008 } from "./structured-data.js";
import { evalAEO001, evalAEO002, evalAEO003, evalAEO004, evalAEO005, evalAEO006, evalAEO007, evalAEO008, evalAEO009, evalAEO010, evalAEO011 } from "./aeo.js";
import { evalGEO001, evalGEO002, evalGEO003, evalGEO004, evalGEO005, evalGEO006, evalGEO007, evalGEO008, evalGEO009, evalGEO010, evalGEO011 } from "./geo.js";
import { evalI18N001, evalI18N002, evalI18N003, evalI18N004, evalA11Y001, evalA11Y002, evalA11Y003, evalA11Y004, evalMOB001, evalAGT001, evalAGT002 } from "./i18n-accessibility.js";
import { evalPRF001, evalPRF002, evalPRF003, evalPRF004, evalSEC001, evalSEC002, evalSEC003, evalDEL001 } from "./performance-security.js";

export interface EvaluatorEntry {
  rule_id: string;
  scope: "site" | "page";
  evaluate: Evaluator | PageEvaluator;
}

/**
 * Complete registry of all 77 rule evaluators.
 * Site-scope rules use `Evaluator` (bundle → result).
 * Page-scope rules use `PageEvaluator` (page, bundle → result).
 */
export const EVALUATOR_REGISTRY: EvaluatorEntry[] = [
  // ── Crawlability ──────────────────────────────────────────────────────────
  { rule_id: "CRW-001", scope: "site", evaluate: evalCRW001 },
  { rule_id: "CRW-002", scope: "site", evaluate: evalCRW002 },
  { rule_id: "CRW-003", scope: "site", evaluate: evalCRW003 },
  { rule_id: "CRW-004", scope: "site", evaluate: evalCRW004 },
  { rule_id: "CRW-005", scope: "page", evaluate: evalCRW005 },
  { rule_id: "CRW-006", scope: "page", evaluate: evalCRW006 },
  { rule_id: "CRW-007", scope: "page", evaluate: evalCRW007 },
  { rule_id: "CRW-008", scope: "page", evaluate: evalCRW008 },
  { rule_id: "CRW-009", scope: "page", evaluate: evalCRW009 },
  { rule_id: "CRW-010", scope: "page", evaluate: evalCRW010 },
  { rule_id: "CRW-011", scope: "page", evaluate: evalCRW011 },
  { rule_id: "CRW-012", scope: "page", evaluate: evalCRW012 },

  // ── On-page SEO ───────────────────────────────────────────────────────────
  { rule_id: "SEO-001", scope: "page", evaluate: evalSEO001 },
  { rule_id: "SEO-002", scope: "page", evaluate: evalSEO002 },
  { rule_id: "SEO-003", scope: "page", evaluate: evalSEO003 },
  { rule_id: "SEO-004", scope: "page", evaluate: evalSEO004 },
  { rule_id: "SEO-005", scope: "page", evaluate: evalSEO005 },
  { rule_id: "SEO-006", scope: "page", evaluate: evalSEO006 },
  { rule_id: "SEO-007", scope: "page", evaluate: evalSEO007 },
  { rule_id: "SEO-008", scope: "page", evaluate: evalSEO008 },
  { rule_id: "SEO-009", scope: "page", evaluate: evalSEO009 },
  { rule_id: "SEO-010", scope: "page", evaluate: evalSEO010 },
  { rule_id: "SEO-011", scope: "page", evaluate: evalSEO011 },
  { rule_id: "SEO-012", scope: "page", evaluate: evalSEO012 },

  // ── Spam (site-scope) ─────────────────────────────────────────────────────
  { rule_id: "SPAM-001", scope: "site", evaluate: evalSPAM001 },

  // ── Structured Data ───────────────────────────────────────────────────────
  { rule_id: "STR-001", scope: "page", evaluate: evalSTR001 },
  { rule_id: "STR-002", scope: "page", evaluate: evalSTR002 },
  { rule_id: "STR-003", scope: "page", evaluate: evalSTR003 },
  { rule_id: "STR-004", scope: "page", evaluate: evalSTR004 },
  { rule_id: "STR-005", scope: "page", evaluate: evalSTR005 },
  { rule_id: "STR-006", scope: "page", evaluate: evalSTR006 },
  { rule_id: "STR-007", scope: "page", evaluate: evalSTR007 },
  { rule_id: "STR-008", scope: "page", evaluate: evalSTR008 },

  // ── AEO ───────────────────────────────────────────────────────────────────
  { rule_id: "AEO-001", scope: "page", evaluate: evalAEO001 },
  { rule_id: "AEO-002", scope: "page", evaluate: evalAEO002 },
  { rule_id: "AEO-003", scope: "page", evaluate: evalAEO003 },
  { rule_id: "AEO-004", scope: "page", evaluate: evalAEO004 },
  { rule_id: "AEO-005", scope: "page", evaluate: evalAEO005 },
  { rule_id: "AEO-006", scope: "page", evaluate: evalAEO006 },
  { rule_id: "AEO-007", scope: "page", evaluate: evalAEO007 },
  { rule_id: "AEO-008", scope: "page", evaluate: evalAEO008 },
  { rule_id: "AEO-009", scope: "page", evaluate: evalAEO009 },
  { rule_id: "AEO-010", scope: "page", evaluate: evalAEO010 },
  { rule_id: "AEO-011", scope: "page", evaluate: evalAEO011 },

  // ── GEO ───────────────────────────────────────────────────────────────────
  { rule_id: "GEO-001", scope: "page", evaluate: evalGEO001 },
  { rule_id: "GEO-002", scope: "page", evaluate: evalGEO002 },
  { rule_id: "GEO-003", scope: "page", evaluate: evalGEO003 },
  { rule_id: "GEO-004", scope: "page", evaluate: evalGEO004 },
  { rule_id: "GEO-005", scope: "page", evaluate: evalGEO005 },
  { rule_id: "GEO-006", scope: "page", evaluate: evalGEO006 },
  { rule_id: "GEO-007", scope: "page", evaluate: evalGEO007 },
  { rule_id: "GEO-008", scope: "page", evaluate: evalGEO008 },
  { rule_id: "GEO-009", scope: "page", evaluate: evalGEO009 },
  { rule_id: "GEO-010", scope: "page", evaluate: evalGEO010 },
  { rule_id: "GEO-011", scope: "page", evaluate: evalGEO011 },

  // ── I18N / Accessibility ──────────────────────────────────────────────────
  { rule_id: "I18N-001", scope: "page", evaluate: evalI18N001 },
  { rule_id: "I18N-002", scope: "page", evaluate: evalI18N002 },
  { rule_id: "I18N-003", scope: "page", evaluate: evalI18N003 },
  { rule_id: "I18N-004", scope: "page", evaluate: evalI18N004 },
  { rule_id: "A11Y-001", scope: "page", evaluate: evalA11Y001 },
  { rule_id: "A11Y-002", scope: "page", evaluate: evalA11Y002 },
  { rule_id: "A11Y-003", scope: "page", evaluate: evalA11Y003 },
  { rule_id: "A11Y-004", scope: "page", evaluate: evalA11Y004 },
  { rule_id: "MOB-001", scope: "page", evaluate: evalMOB001 },
  { rule_id: "AGT-001", scope: "page", evaluate: evalAGT001 },
  { rule_id: "AGT-002", scope: "page", evaluate: evalAGT002 },

  // ── Performance / Security / Delivery ─────────────────────────────────────
  { rule_id: "PRF-001", scope: "page", evaluate: evalPRF001 },
  { rule_id: "PRF-002", scope: "page", evaluate: evalPRF002 },
  { rule_id: "PRF-003", scope: "page", evaluate: evalPRF003 },
  { rule_id: "PRF-004", scope: "page", evaluate: evalPRF004 },
  { rule_id: "SEC-001", scope: "page", evaluate: evalSEC001 },
  { rule_id: "SEC-002", scope: "page", evaluate: evalSEC002 },
  { rule_id: "SEC-003", scope: "page", evaluate: evalSEC003 },
  { rule_id: "DEL-001", scope: "page", evaluate: evalDEL001 },
];

/**
 * Build a lookup map from rule_id → EvaluatorEntry for O(1) access.
 */
export function buildEvaluatorMap(): Map<string, EvaluatorEntry> {
  const map = new Map<string, EvaluatorEntry>();
  for (const entry of EVALUATOR_REGISTRY) {
    map.set(entry.rule_id, entry);
  }
  return map;
}
