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
