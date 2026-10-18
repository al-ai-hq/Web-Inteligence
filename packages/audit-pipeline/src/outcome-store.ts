import type { RuleCategory } from "@wpi/rules-engine";

/** Metrics the outcome log can track: the overall score plus each rule category. */
export type OutcomeMetric = "presence_readiness" | RuleCategory;

export const OUTCOME_METRICS: readonly OutcomeMetric[] = [
  "presence_readiness",
  "crawlability",
  "on_page",
  "structured_data",
  "aeo",
  "geo",
  "i18n_accessibility",
  "performance_security",
];

export interface RecommendationOutcome {
  id: string;
  user_id: string;
  rule_id: string;
  audit_id_applied: string;
  audit_id_measured: string | null;
  metric: OutcomeMetric;
  value_before: number | null;
  value_after: number | null;
  as_of_before: string | null;
  as_of_after: string | null;
  /**
   * `correlation_only` is the only label M10 writes: a later audit that scores
   * higher is not proof the recommendation caused it. The other labels exist so
   * a future controlled measurement does not require a schema change.
   */
  fidelity_label: "correlation_only" | "measured" | "inferred";
  source: "user_marked_applied";
  created_at: string;
  updated_at: string;
}

export interface MarkAppliedInput {
  userId: string;
  ruleId: string;
  auditIdApplied: string;
  metric: OutcomeMetric;
}

export interface OutcomeDelta {
  ruleId: string;
  metric: OutcomeMetric;
  /**
   * The applied audit this delta closes out. Matching on it keeps one site's
   * measurement from consuming a pending outcome recorded against another site.
   */
  auditIdApplied: string;
  valueBefore: number | null;
  valueAfter: number | null;
}

export interface RecordDeltasInput {
  userId: string;
  auditIdMeasured: string;
  /** ISO timestamps of the two audits being compared, for lineage on the numbers. */
  asOfBefore: string;
  asOfAfter: string;
  deltas: OutcomeDelta[];
}

export interface OutcomeStore {
  /** Idempotent for the same (user, rule, applied audit, metric) tuple. */
  markApplied(input: MarkAppliedInput): Promise<RecommendationOutcome>;
  listPendingForUser(userId: string): Promise<RecommendationOutcome[]>;
  recordDeltas(input: RecordDeltasInput): Promise<RecommendationOutcome[]>;
  listForAudit(auditId: string): Promise<RecommendationOutcome[]>;
}
