/**
 * Findings generation — maps site-scope RuleResults to user-facing Findings with severity.
 *
 * Implements spec §8.1:
 * - Only failed/partial results produce findings (pass/not_applicable/unavailable/error are excluded).
 * - Report-only unscored rules (no critical_cap) never produce findings.
 * - Severity is determined by result × importance_weight/critical_cap:
 *   fail + (weight≥4 or critical_cap) → critical
 *   fail + weight=3 → high
 *   fail + weight≤2 → medium
 *   partial + (weight≥4 or critical_cap) → high
 *   partial + weight=3 → medium
 *   partial + weight≤2 → low
 * - evidence_state: deterministic→verified, assessed→inferred, attested→client_stated.
 */

import type {
  RuleResult,
  LoadedRule,
  Finding,
  Severity,
  EvidenceState,
} from "./types.js";

/** Results that produce findings. */
const FINDING_RESULTS = new Set(["fail", "partial"]);

/**
 * Map evaluation method to evidence_state (spec §8.1).
 */
function mapEvidenceState(evaluation: LoadedRule["evaluation"]): EvidenceState {
  switch (evaluation) {
    case "deterministic":
      return "verified";
    case "assessed":
      return "inferred";
    case "attested":
      return "client_stated";
  }
}

/**
 * Determine severity from rule result and rule properties (spec §8.1 table).
 *
 * @param result - "fail" or "partial"
 * @param rule - the loaded rule definition
 */
function mapSeverity(result: "fail" | "partial", rule: LoadedRule): Severity {
  const isHighWeightOrCritical = rule.importance_weight >= 4 || rule.critical_cap != null;

  if (result === "fail") {
    if (isHighWeightOrCritical) return "critical";
    if (rule.importance_weight === 3) return "high";
    return "medium"; // weight <= 2
  }

  // result === "partial"
  if (isHighWeightOrCritical) return "high";
  if (rule.importance_weight === 3) return "medium";
  return "low"; // weight <= 2
}

/**
 * Generate findings from site-scope RuleResults.
 *
 * Filters to only failed/partial rules, excludes report-only unscored rules
 * (those without a critical_cap), and maps each to a Finding with severity.
 */
export function generateFindings(results: RuleResult[], rules: LoadedRule[]): Finding[] {
  // Build rule lookup
  const ruleMap = new Map<string, LoadedRule>();
  for (const rule of rules) {
    ruleMap.set(rule.id, rule);
  }

  const findings: Finding[] = [];

  for (const result of results) {
    // Only fail/partial produce findings
    if (!FINDING_RESULTS.has(result.result)) continue;

    const rule = ruleMap.get(result.rule_id);
    if (!rule) continue;

    // Report-only unscored rules (no critical_cap) never produce findings
    // Spec §8.1: "GSC-003, GEO-010, AGT-002 are report-only — their results
    // render in the report but never produce findings"
    if (!rule.scored && rule.critical_cap == null) continue;

    const severity = mapSeverity(result.result as "fail" | "partial", rule);

    findings.push({
      rule_id: result.rule_id,
      severity,
      evidence_ids: result.evidence_ids,
      rationale: result.rationale,
      category: rule.category,
      evidence_state: mapEvidenceState(rule.evaluation),
      affected_scope: {
        sampled: true,
        urls: result.affected_urls.length > 0 ? result.affected_urls : undefined,
      },
    });
  }

  return findings;
}
