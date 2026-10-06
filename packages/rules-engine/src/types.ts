import type { EvidenceBundle, PageEvidence } from "./evidence.js";

export type RuleCategory =
  | "crawlability"
  | "on_page"
  | "structured_data"
  | "aeo"
  | "geo"
  | "i18n_accessibility"
  | "performance_security";

export interface LoadedRule {
  id: string;
  category: RuleCategory;
  title: string;
  importance_weight: number;
  scored: boolean;
  evaluation: "deterministic" | "assessed" | "attested";
  connected_tier_only: boolean;
  requires_data?: "keyword_data" | "business_profile_or_merchant_center";
  critical_cap?: string;
  applicability: string;
  standards: { pass?: string; partial?: string; fail?: string; report?: string };
  fidelity_label: string;
}

export interface ScoringConfig {
  methodology_version: string;
  category_weights: Record<RuleCategory, number>;
  result_values: { pass: 1; partial: 0.5; fail: 0 };
  critical_caps: Array<{ cap_id: string; max_score: number; trigger_rule: string }>;
  confidence: { high_min_coverage: 0.9; medium_min_coverage: 0.7 };
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrityError";
  }
}

// ─── Lineage types ────────────────────────────────────────────────────────────

export interface Lineage {
  parent_ids: string[];
  fidelity_label: string;
  content_hash: string;
  method: string;
  validation_state: string;
}

// ─── Evaluator types ──────────────────────────────────────────────────────────

export interface RuleEvaluation {
  result: "pass" | "partial" | "fail" | "not_applicable" | "unavailable" | "error";
  evidence_ids: string[];
  rationale?: string;
  cap_trigger?: boolean;
}

export type Evaluator = (bundle: EvidenceBundle) => RuleEvaluation;
export type PageEvaluator = (page: PageEvidence, bundle: EvidenceBundle) => RuleEvaluation;

// ─── Engine result types ──────────────────────────────────────────────────────

/** Per-page result: one per rule per page. */
export interface PageRuleResult {
  rule_id: string;
  page_id: string;
  result: RuleEvaluation["result"];
  evidence_ids: string[];
  rationale?: string;
  cap_trigger?: boolean;
}

/** Site-scope aggregated result: one per rule for the whole site. */
export interface RuleResult {
  rule_id: string;
  result: RuleEvaluation["result"];
  evidence_ids: string[];
  rationale?: string;
  cap_trigger?: boolean;
  scope: "site" | "template";
  affected_urls: string[];
  /** Only set when scope === "template" */
  template_cluster_key?: string;
  /** Ratio of fail-equivalent pages (for page-scoped rules aggregated to site). */
  failed_ratio?: number;
}

/** Template cluster: a group of pages sharing a URL pattern. */
export interface TemplateCluster {
  cluster_key: string;
  page_ids: string[];
  urls: string[];
}

// ─── Scoring output types ─────────────────────────────────────────────────────

/** Score for a single presence category. */
export interface CategoryScore {
  category: RuleCategory;
  /** Full precision score 0-100, or null when category has no measurable rules. */
  value: number | null;
  /** Sum of importance_weight for rules with pass/partial/fail in this category. */
  measurable_weight: number;
  /** Sum of importance_weight for all scored rules in this category. */
  total_weight: number;
}

/** A critical cap that was triggered and applied. */
export interface AppliedCap {
  cap_id: string;
  max_score: number;
  rule_id: string;
  reason_key: string;
}

/** Confidence level for the score. */
export type ConfidenceLevel = "high" | "medium" | "low";

/** Context for confidence calculation beyond coverage. */
export interface ScoringContext {
  /** Number of pages inspected in the audit. */
  pages_inspected?: number;
  /** Whether the homepage was inspected. */
  homepage_inspected?: boolean;
  /** Pipeline stages that completed without degradation. */
  critical_stages_completed?: string[];
}

/** The full Presence Readiness score result. */
export interface ScoreResult {
  methodology_version: string;
  /** Final readiness after caps, 0-100 full precision. null when no measurable categories. */
  presence_readiness: number | null;
  /** Readiness before critical caps are applied. null when no measurable categories. */
  pre_cap_value: number | null;
  /** Critical caps that were triggered. */
  applied_caps: AppliedCap[];
  /** Per-category scores (all 7 categories). */
  categories: CategoryScore[];
  /** Coverage: measurable_applicable_weight / total_expected_applicable_weight. */
  coverage: number;
  /** Confidence level based on coverage and context. */
  confidence: ConfidenceLevel;
  /** Categories that had no measurable rules (value: null). */
  unavailable_categories: RuleCategory[];
}

// ─── Findings types ──────────────────────────────────────────────────────────

/** Severity level for a finding (spec §8.1). */
export type Severity = "critical" | "high" | "medium" | "low";

/** Evidence state derived from rule evaluation method (spec §8.1). */
export type EvidenceState = "verified" | "inferred" | "client_stated";

/** A user-facing finding derived from a failed or partial rule result. */
export interface Finding {
  rule_id: string;
  severity: Severity;
  evidence_ids: string[];
  rationale?: string;
  category: RuleCategory;
  /** Mapping from evaluation method: deterministic→verified, assessed→inferred, attested→client_stated. */
  evidence_state: EvidenceState;
  /** Affected scope; sampled is always true for anonymous audits. */
  affected_scope: {
    sampled: true;
    urls?: string[];
  };
}

// ─── Priority types ──────────────────────────────────────────────────────────

/** Priority group assignment (spec §8.2, precedence order). */
export type PriorityGroup =
  | "critical_blocker"
  | "measurement_fix"
  | "quick_win"
  | "strategic_opportunity"
  | "polish";

/** Horizon bucket for remediation timeline (spec §8.2). */
export type Horizon = "0-30d" | "31-60d" | "61-90d";

/** Display band for UI rendering (spec §8.2). */
export type DisplayBand = 1 | 2 | 3 | 4;

/** A prioritized item for the action board. */
export interface PriorityItem {
  rule_id: string;
  severity: Severity;
  priority_value: number;
  group: PriorityGroup;
  horizon: Horizon;
  display_band: DisplayBand;
  category: RuleCategory;
  evidence_ids: string[];
  rationale?: string;
}
