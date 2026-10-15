/**
 * Priority calculation — assigns priority_value, group, horizon, and display band.
 *
 * Implements spec §8.2:
 * - priority_value = impact × reach × confidence_factor / effort
 * - impact = rule.importance_weight (1-5)
 * - reach = ceil(5 × affected_pages / pages_checked), clamped to [1, 5]
 * - effort = per-category constant
 * - confidence_factor = high 1.0 / medium 0.75 / low 0.5
 * - groups (precedence): critical_blocker > measurement_fix > quick_win > strategic_opportunity > polish
 * - measurement_fix: from unavailable RuleResults, impact=weight, reach=5, effort=1
 * - display bands: critical ≥ 10, high ≥ 6, medium ≥ 3, low < 3
 * - horizons: 0-30d = critical band or critical_blocker; 31-60d = high/medium band; 61-90d = low band
 */

import type {
  Finding,
  LoadedRule,
  RuleResult,
  RuleCategory,
  ConfidenceLevel,
  PriorityItem,
  PriorityGroup,
  Horizon,
  DisplayBand,
} from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Effort constants per category (spec §8.2). */
const EFFORT_BY_CATEGORY: Record<RuleCategory, number> = {
  crawlability: 2,
  on_page: 2,
  structured_data: 3,
  aeo: 3,
  geo: 4,
  i18n_accessibility: 3,
  performance_security: 3,
};

/** Confidence factor multipliers (spec §8.2). */
const CONFIDENCE_FACTOR: Record<ConfidenceLevel, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

// ─── Options ──────────────────────────────────────────────────────────────────

export interface PriorityOptions {
  confidence_level: ConfidenceLevel;
  pages_checked: number;
  /** Unavailable RuleResults for measurement_fix items (spec §8.2). */
  unavailable_results?: RuleResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate reach: ceil(5 × affected_pages / pages_checked), clamped [1, 5].
 */
function calculateReach(affectedPages: number, pagesChecked: number): number {
  if (pagesChecked <= 0) return 1;
  const raw = Math.ceil((5 * affectedPages) / pagesChecked);
  return Math.max(1, Math.min(5, raw));
}

/**
 * Assign display band from priority_value (spec §8.2).
 * - Band 1 (critical): priority_value >= 10
 * - Band 2 (high): priority_value >= 6
 * - Band 3 (medium): priority_value >= 3
 * - Band 4 (low): priority_value < 3
 */
function assignDisplayBand(priorityValue: number): DisplayBand {
  if (priorityValue >= 10) return 1;
  if (priorityValue >= 6) return 2;
  if (priorityValue >= 3) return 3;
  return 4;
}

/**
 * Assign group from severity and rule properties (spec §8.2, precedence order).
 */
function assignGroup(severity: Finding["severity"], impact: number, effort: number): PriorityGroup {
  // Precedence: critical_blocker > quick_win > strategic_opportunity > polish
  if (severity === "critical") return "critical_blocker";
  if (effort <= 2 && impact >= 3) return "quick_win";
  if (effort >= 4) return "strategic_opportunity";
  return "polish";
}

/**
 * Assign horizon from display band and group (spec §8.2).
 * - "0-30d" = critical band (1) or critical_blocker group
 * - "31-60d" = high (2) or medium (3) band
 * - "61-90d" = low (4) band
 */
function assignHorizon(displayBand: DisplayBand, group: PriorityGroup): Horizon {
  if (displayBand === 1 || group === "critical_blocker") return "0-30d";
  if (displayBand === 2 || displayBand === 3) return "31-60d";
  return "61-90d";
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Calculate priority for findings and optional unavailable results.
 *
 * Returns PriorityItem[] sorted by:
 * 1. critical_blockers first
 * 2. measurement_fix next
 * 3. remaining by priority_value descending
 */
export function calculatePriority(
  findings: Finding[],
  rules: LoadedRule[],
  options: PriorityOptions,
): PriorityItem[] {
  const { confidence_level, pages_checked, unavailable_results } = options;
  const confidenceFactor = CONFIDENCE_FACTOR[confidence_level];

  // Build rule lookup
  const ruleMap = new Map<string, LoadedRule>();
  for (const rule of rules) {
    ruleMap.set(rule.id, rule);
  }

  const items: PriorityItem[] = [];

  // Process findings
  for (const finding of findings) {
    const rule = ruleMap.get(finding.rule_id);
    if (!rule) continue;

    const impact = rule.importance_weight;
    const effort = EFFORT_BY_CATEGORY[finding.category] ?? 3;
    const affectedPages = finding.affected_scope.urls?.length ?? 0;
    const reach = calculateReach(affectedPages, pages_checked);

    const priorityValue = (impact * reach * confidenceFactor) / effort;
    const group = assignGroup(finding.severity, impact, effort);
    const displayBand = assignDisplayBand(priorityValue);
    const horizon = assignHorizon(displayBand, group);

    items.push({
      rule_id: finding.rule_id,
      severity: finding.severity,
      priority_value: priorityValue,
      group,
      horizon,
      display_band: displayBand,
      category: finding.category,
      evidence_ids: finding.evidence_ids,
      rationale: finding.rationale,
    });
  }

  // Process measurement_fix items from unavailable results
  if (unavailable_results) {
    for (const result of unavailable_results) {
      if (result.result !== "unavailable") continue;

      const rule = ruleMap.get(result.rule_id);
      if (!rule) continue;

      // measurement_fix: impact=weight, reach=5, effort=1
      const impact = rule.importance_weight;
      const priorityValue = impact * 5 * confidenceFactor;
      const displayBand = assignDisplayBand(priorityValue);
      const horizon = assignHorizon(displayBand, "measurement_fix");

      items.push({
        rule_id: result.rule_id,
        severity: "medium",
        priority_value: priorityValue,
        group: "measurement_fix",
        horizon,
        display_band: displayBand,
        category: rule.category,
        evidence_ids: result.evidence_ids,
        rationale: result.rationale,
      });
    }
  }

  // Sort: critical_blockers first, then measurement_fix, then by priority_value desc
  const groupOrder: Record<PriorityGroup, number> = {
    critical_blocker: 0,
    measurement_fix: 1,
    quick_win: 2,
    strategic_opportunity: 3,
    polish: 4,
  };

  items.sort((a, b) => {
    const groupDiff = groupOrder[a.group] - groupOrder[b.group];
    if (groupDiff !== 0) return groupDiff;
    return b.priority_value - a.priority_value;
  });

  return items;
}
