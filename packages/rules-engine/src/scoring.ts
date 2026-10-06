/**
 * Scoring engine — calculates Presence Readiness from site-scope RuleResults.
 *
 * Implements spec §7:
 * 1. Category score: 100 * Σ(result_value × weight) / Σ(weight) over scored rules
 *    with pass/partial/fail in that category. Empty denominator → null.
 * 2. Pre-cap readiness: Σ(category_value × category_weight) / Σ(category_weight)
 *    over available categories (renormalized).
 * 3. Critical caps: readiness = min(pre_cap, every triggered cap.max_score).
 * 4. Confidence: high/medium/low based on coverage and context.
 *
 * Only site-scope RuleResults are consumed for scoring (template-scoped results
 * are informational only per spec §6.2).
 */

import type {
  RuleResult,
  LoadedRule,
  ScoringConfig,
  RuleCategory,
  CategoryScore,
  AppliedCap,
  ConfidenceLevel,
  ScoreResult,
  ScoringContext,
} from "./types.js";

const ALL_CATEGORIES: RuleCategory[] = [
  "crawlability",
  "on_page",
  "structured_data",
  "aeo",
  "geo",
  "i18n_accessibility",
  "performance_security",
];

const SCORABLE_RESULTS = new Set(["pass", "partial", "fail"]);

const RESULT_VALUES: Record<string, number> = {
  pass: 1.0,
  partial: 0.5,
  fail: 0.0,
};

const CRITICAL_STAGES = ["VALIDATING", "CRAWLING", "EXTRACTING", "AUDITING"];

// ─── Category Scores ──────────────────────────────────────────────────────────

/**
 * Calculate weighted score for each of the 7 presence categories.
 *
 * Formula (spec §7.1):
 *   category_score_c = 100 * Σ(result_value_r × importance_weight_r) / Σ(importance_weight_r)
 *   both sums over scored rules r in category c whose result ∈ {pass, partial, fail}.
 *
 * Empty denominator → value: null (category unavailable).
 * Unscored rules (importance_weight = 0) are excluded from the denominator.
 */
export function calculateCategoryScores(
  results: RuleResult[],
  rules: LoadedRule[],
  config: ScoringConfig,
): CategoryScore[] {
  // Build rule lookup: rule_id → LoadedRule
  const ruleMap = new Map<string, LoadedRule>();
  for (const rule of rules) {
    ruleMap.set(rule.id, rule);
  }

  // Only consider site-scope results for scoring
  const siteResults = results.filter((r) => r.scope === "site");

  // Group site-scope results by category
  const categoryResults = new Map<RuleCategory, RuleResult[]>();
  for (const cat of ALL_CATEGORIES) {
    categoryResults.set(cat, []);
  }

  for (const result of siteResults) {
    const rule = ruleMap.get(result.rule_id);
    if (!rule) continue;
    const catResults = categoryResults.get(rule.category);
    if (catResults) {
      catResults.push(result);
    }
  }

  // Calculate score per category
  const scores: CategoryScore[] = [];
  for (const category of ALL_CATEGORIES) {
    const catResults = categoryResults.get(category) ?? [];
    const catRules = rules.filter((r) => r.category === category && r.scored);

    let weightedSum = 0;
    let measurableWeight = 0;
    let totalWeight = 0;

    for (const rule of catRules) {
      totalWeight += rule.importance_weight;

      const result = catResults.find((r) => r.rule_id === rule.id);
      if (result && SCORABLE_RESULTS.has(result.result)) {
        const value = RESULT_VALUES[result.result] ?? 0;
        weightedSum += value * rule.importance_weight;
        measurableWeight += rule.importance_weight;
      }
    }

    const value = measurableWeight > 0 ? (100 * weightedSum) / measurableWeight : null;

    scores.push({
      category,
      value,
      measurable_weight: measurableWeight,
      total_weight: totalWeight,
    });
  }

  return scores;
}

// ─── Pre-cap Readiness ────────────────────────────────────────────────────────

/**
 * Calculate pre-cap readiness as renormalized weighted average of available category scores.
 *
 * Formula (spec §7.2):
 *   readiness_pre_cap = Σ(category_score_c × category_weight_c) / Σ(category_weight_c)
 *   over categories where value is not null.
 *
 * Returns null when no categories have measurable scores.
 */
export function calculatePreCapReadiness(
  categoryScores: CategoryScore[],
  config: ScoringConfig,
): number | null {
  let weightedSum = 0;
  let totalCategoryWeight = 0;

  for (const catScore of categoryScores) {
    if (catScore.value === null) continue;
    const catWeight = config.category_weights[catScore.category] ?? 0;
    weightedSum += catScore.value * catWeight;
    totalCategoryWeight += catWeight;
  }

  if (totalCategoryWeight === 0) return null;

  return weightedSum / totalCategoryWeight;
}

// ─── Critical Caps ────────────────────────────────────────────────────────────

/**
 * Apply critical caps to the pre-cap readiness score.
 *
 * Spec §7.3: readiness = min(pre_cap, every triggered cap.max_score).
 *
 * Cap trigger conditions:
 * - 5 rule-condition caps (CRW-001, CRW-003, CRW-004, DEL-001, PRF-001):
 *   trigger when the rule's site-scope result is "fail".
 * - spam_policy_confirmed (SPAM-001): triggers when result is "fail" AND
 *   cap_trigger flag is true on the RuleResult.
 *
 * A cap is only "applied" (recorded) if it actually lowers the score.
 */
export function applyCriticalCaps(
  results: RuleResult[],
  preCapValue: number | null,
  config: ScoringConfig,
): { readiness: number | null; appliedCaps: AppliedCap[] } {
  if (preCapValue === null) {
    return { readiness: null, appliedCaps: [] };
  }

  // Build result lookup for site-scope results only
  const resultMap = new Map<string, RuleResult>();
  for (const r of results) {
    if (r.scope === "site") {
      resultMap.set(r.rule_id, r);
    }
  }

  const appliedCaps: AppliedCap[] = [];
  let minCap = preCapValue;

  for (const cap of config.critical_caps) {
    const ruleResult = resultMap.get(cap.trigger_rule);
    if (!ruleResult) continue;

    let triggered = false;

    if (cap.cap_id === "spam_policy_confirmed") {
      // SPAM-001 requires both fail result AND cap_trigger flag
      triggered = ruleResult.result === "fail" && ruleResult.cap_trigger === true;
    } else {
      // Standard rule-condition caps: trigger on fail
      triggered = ruleResult.result === "fail";
    }

    if (triggered) {
      appliedCaps.push({
        cap_id: cap.cap_id,
        max_score: cap.max_score,
        rule_id: cap.trigger_rule,
        reason_key: `cap.${cap.cap_id}`,
      });
      if (cap.max_score < minCap) {
        minCap = cap.max_score;
      }
    }
  }

  return { readiness: minCap, appliedCaps };
}

// ─── Confidence ───────────────────────────────────────────────────────────────

/**
 * Calculate confidence level based on coverage and scoring context.
 *
 * Spec §7.4 (evaluation order: test high first, then medium, else low):
 * - High: coverage >= 0.90 AND pages_inspected >= 10 AND all critical stages completed.
 * - Medium: coverage >= 0.70 AND homepage_inspected AND pages_inspected >= 5
 *   (at least homepage + 4 important pages).
 * - Low: everything else.
 *
 * Without full context, confidence is limited to medium at most.
 */
export function calculateConfidence(
  coverage: number,
  context: ScoringContext,
): ConfidenceLevel {
  const highMinCoverage = 0.9;
  const mediumMinCoverage = 0.7;

  // Test high first
  if (coverage >= highMinCoverage) {
    const pagesInspected = context.pages_inspected ?? 0;
    const stagesCompleted = context.critical_stages_completed ?? [];
    const allStagesCompleted = CRITICAL_STAGES.every((stage) =>
      stagesCompleted.includes(stage),
    );

    if (pagesInspected >= 10 && allStagesCompleted) {
      return "high";
    }
  }

  // Test medium
  if (coverage >= mediumMinCoverage) {
    const pagesInspected = context.pages_inspected ?? 0;
    const homepageInspected = context.homepage_inspected ?? false;

    // Need homepage + at least 4 other pages = 5 total
    if (homepageInspected && pagesInspected >= 5) {
      return "medium";
    }
  }

  return "low";
}

// ─── Coverage ─────────────────────────────────────────────────────────────────

/**
 * Calculate coverage: measurable_applicable_weight / total_expected_applicable_weight.
 *
 * Spec §6.3:
 *   total_expected = Σ importance_weight of all scored rules in the catalog
 *   measurable     = Σ importance_weight of scored rules whose result ∈ {pass, partial, fail}
 *   coverage       = measurable / total_expected
 *
 * Only site-scope results are considered.
 */
function calculateCoverage(
  results: RuleResult[],
  rules: LoadedRule[],
): number {
  const scoredRules = rules.filter((r) => r.scored);
  if (scoredRules.length === 0) return 0;

  // Build result lookup for site-scope results
  const resultMap = new Map<string, RuleResult>();
  for (const r of results) {
    if (r.scope === "site") {
      resultMap.set(r.rule_id, r);
    }
  }

  let totalWeight = 0;
  let measurableWeight = 0;

  for (const rule of scoredRules) {
    totalWeight += rule.importance_weight;
    const result = resultMap.get(rule.id);
    if (result && SCORABLE_RESULTS.has(result.result)) {
      measurableWeight += rule.importance_weight;
    }
  }

  if (totalWeight === 0) return 0;
  return measurableWeight / totalWeight;
}

// ─── Full Score Calculation ───────────────────────────────────────────────────

/**
 * Calculate the full Presence Readiness ScoreResult.
 *
 * Pipeline: category scores → pre-cap readiness → critical caps → confidence.
 * Only site-scope RuleResults are used for scoring (spec §6.2).
 */
export function calculateScore(
  results: RuleResult[],
  rules: LoadedRule[],
  config: ScoringConfig,
  context: ScoringContext,
): ScoreResult {
  // 1. Category scores
  const categoryScores = calculateCategoryScores(results, rules, config);

  // 2. Pre-cap readiness (renormalized over available categories)
  const preCapValue = calculatePreCapReadiness(categoryScores, config);

  // 3. Critical caps
  const { readiness, appliedCaps } = applyCriticalCaps(results, preCapValue, config);

  // 4. Coverage
  const coverage = calculateCoverage(results, rules);

  // 5. Confidence
  const confidence = calculateConfidence(coverage, context);

  // 6. Unavailable categories
  const unavailableCategories = categoryScores
    .filter((c) => c.value === null)
    .map((c) => c.category);

  return {
    methodology_version: config.methodology_version,
    presence_readiness: readiness,
    pre_cap_value: preCapValue,
    applied_caps: appliedCaps,
    categories: categoryScores,
    coverage,
    confidence,
    unavailable_categories: unavailableCategories,
  };
}
