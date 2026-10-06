/**
 * Engine runner — evaluates all applicable rules against an EvidenceBundle.
 *
 * Site-scope rules (Evaluator) run once against the full bundle.
 * Page-scope rules (PageEvaluator) run once per page in the bundle.
 *
 * Returns PageRuleResult[] — one entry per rule per page (or per rule for site-scope).
 */

import type { EvidenceBundle, PageEvidence } from "./evidence.js";
import type { Evaluator, PageEvaluator, PageRuleResult } from "./types.js";
import type { RuleCatalog } from "./rule-catalog.js";
import { buildEvaluatorMap } from "./evaluators/index.js";

/**
 * Run the deterministic rules engine against an evidence bundle.
 *
 * For each applicable rule in the catalog:
 * - Site-scope rules: evaluate once, produce one result with page_id = "site"
 * - Page-scope rules: evaluate per page, produce one result per page
 *
 * If an evaluator throws, the result is "error" with the error message as rationale.
 * This ensures a buggy evaluator degrades gracefully without fabricating a pass.
 */
export function runRulesEngine(
  bundle: EvidenceBundle,
  catalog: RuleCatalog,
): PageRuleResult[] {
  const results: PageRuleResult[] = [];
  const evaluatorMap = buildEvaluatorMap();
  const applicableRules = catalog.getAllRules();

  for (const rule of applicableRules) {
    const entry = evaluatorMap.get(rule.id);
    if (!entry) {
      // Rule exists in catalog but has no evaluator (e.g. GSC rules not implemented in M2).
      // Emit unavailable for site-scope.
      if (rule.evaluation === "assessed") {
        results.push({
          rule_id: rule.id,
          page_id: "site",
          result: "unavailable",
          evidence_ids: [],
          rationale: "assessed_pending_agent",
        });
      } else if (rule.evaluation === "attested") {
        results.push({
          rule_id: rule.id,
          page_id: "site",
          result: "unavailable",
          evidence_ids: [],
          rationale: "attested_pending_owner",
        });
      } else {
        // Deterministic rule with no evaluator — should not happen for implemented rules
        results.push({
          rule_id: rule.id,
          page_id: "site",
          result: "unavailable",
          evidence_ids: [],
          rationale: `no_evaluator_for_${rule.id}`,
        });
      }
      continue;
    }

    if (entry.scope === "site") {
      // Site-scope evaluator
      const evaluation = safeEvaluateSite(() => entry.evaluate as Evaluator, bundle);
      results.push({
        rule_id: rule.id,
        page_id: "site",
        result: evaluation.result,
        evidence_ids: evaluation.evidence_ids,
        rationale: evaluation.rationale,
        cap_trigger: evaluation.cap_trigger,
      });
    } else {
      // Page-scope evaluator — run for each page in the bundle
      const pageEvaluator = entry.evaluate as PageEvaluator;
      for (const page of bundle.pages) {
        const evaluation = safeEvaluatePage(pageEvaluator, page, bundle);
        results.push({
          rule_id: rule.id,
          page_id: page.evidence_id,
          result: evaluation.result,
          evidence_ids: evaluation.evidence_ids,
          rationale: evaluation.rationale,
          cap_trigger: evaluation.cap_trigger,
        });
      }
    }
  }

  return results;
}

/**
 * Safely run a site-scope evaluator, catching any thrown errors.
 */
function safeEvaluateSite(
  getEvaluator: () => Evaluator,
  bundle: EvidenceBundle,
): { result: "pass" | "partial" | "fail" | "not_applicable" | "unavailable" | "error"; evidence_ids: string[]; rationale?: string; cap_trigger?: boolean } {
  try {
    const evaluator = getEvaluator();
    return evaluator(bundle);
  } catch (err) {
    return {
      result: "error",
      evidence_ids: [],
      rationale: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Safely run a page-scope evaluator, catching any thrown errors.
 */
function safeEvaluatePage(
  evaluator: PageEvaluator,
  page: PageEvidence,
  bundle: EvidenceBundle,
): { result: "pass" | "partial" | "fail" | "not_applicable" | "unavailable" | "error"; evidence_ids: string[]; rationale?: string; cap_trigger?: boolean } {
  try {
    return evaluator(page, bundle);
  } catch (err) {
    return {
      result: "error",
      evidence_ids: [],
      rationale: err instanceof Error ? err.message : String(err),
    };
  }
}
