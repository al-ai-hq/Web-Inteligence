/**
 * Recommendation scoring (M10 spec FR-1/FR-2).
 *
 * priority_score = (impact_score x 2) - effort_score - timeline_score, with every
 * input on the 1-10 integer domain. This is a presentation-layer ranking only: it
 * never feeds Presence Readiness, Experience Effectiveness or AI visibility (D-012).
 */

import { assignBand, compareByBand } from "./recommendation-band.js";
import type { Industry } from "./industry-classifier.js";
import type {
  Finding,
  LoadedRule,
  RecommendationPriorityItem,
  RecommendationScoringConfig,
  Severity,
} from "./types.js";

export interface PriorityOptions {
  industry: Industry;
  siteStage: string;
}

/**
 * importance_weight is validated as 0..5, so a zero-weight rule would otherwise
 * produce an impact_score outside the documented 1..10 input domain.
 */
function toImpact(importanceWeight: number): number {
  return Math.min(10, Math.max(1, importanceWeight * 2));
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Board ordering: bands lead, and inside a band the most severe item comes first,
 * then the best score. Exported so a playbook re-score reuses the same ordering.
 */
export function compareRecommendations(
  a: RecommendationPriorityItem,
  b: RecommendationPriorityItem,
): number {
  const byBand = compareByBand(a.band, b.band);
  if (byBand !== 0) return byBand;
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (bySeverity !== 0) return bySeverity;
  return b.priority_score - a.priority_score || a.rule_id.localeCompare(b.rule_id);
}

export function calculatePriority(
  findings: Finding[],
  rules: LoadedRule[],
  config: RecommendationScoringConfig,
  options: PriorityOptions,
): RecommendationPriorityItem[] {
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

  const items: RecommendationPriorityItem[] = [];

  for (const finding of findings) {
    const rule = ruleById.get(finding.rule_id);
    if (!rule) continue;

    const impact_score = toImpact(rule.importance_weight);
    const effort_score = config.effortByCategory[finding.category];
    const timeline_score =
      rule.recommendation_timeline ?? config.timelineDefaultByCategory[finding.category];
    const priority_score = impact_score * 2 - effort_score - timeline_score;

    items.push({
      rule_id: finding.rule_id,
      severity: finding.severity,
      category: finding.category,
      evidence_ids: finding.evidence_ids,
      rationale: finding.rationale,
      impact_score,
      effort_score,
      timeline_score,
      priority_score,
      band: assignBand(priority_score, config.bandThresholds),
      playbook_id: null,
      playbook_note_key: null,
      industry_classification: options.industry,
      site_stage: options.siteStage,
    });
  }

  items.sort(compareRecommendations);
  return items;
}
