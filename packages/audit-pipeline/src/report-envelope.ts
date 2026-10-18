import type { RecommendationBand, ScoreResult } from "@wpi/rules-engine";
import type { SiteStage } from "./site-identity.js";

export type FindingSection =
  "technical" | "keywords" | "content" | "performance" | "experience" | "entity";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingState = "verified" | "inferred" | "not_verified";

export const SECTION_BY_AGENT: Record<string, FindingSection> = {
  auditor: "technical",
  "keyword-analyst": "keywords",
  "content-strategist": "content",
  "entity-analyst": "entity",
};

export interface StoredFinding {
  id: string;
  agent: string;
  section: FindingSection;
  severity: FindingSeverity;
  state: FindingState;
  confidence: "high" | "medium" | "low";
  evidence_ids: string[];
  data: Record<string, unknown>;
}

export interface UnavailableBlock {
  section: FindingSection | "comparison" | "ai_visibility_panel" | "performance";
  reason_key: string;
}

export interface StoredCostLine {
  agent: string;
  engine: string;
  tokens_in: number;
  tokens_out: number;
  usd: number;
}

export interface StoredCosts {
  currency: "USD";
  agents: StoredCostLine[];
  total_usd: number;
}

/**
 * An action-board row. Rule-derived rows carry the M10 scores; agent-derived rows
 * carry nulls rather than invented numbers, so the UI can tell the two apart.
 */
export interface StoredActionItem {
  title: string;
  detail: string;
  severity: FindingSeverity;
  confidence: "high" | "medium" | "low";
  source_finding_id: string;
  impact_score: number | null;
  effort_score: number | null;
  timeline_score: number | null;
  priority_score: number | null;
  band: RecommendationBand | null;
  playbook_note_key: string | null;
}

/**
 * Which industry the playbooks were applied for, and the signal that decided it,
 * so the UI can show provenance instead of presenting the classification as fact.
 */
export interface StoredRecommendationProvenance {
  industry: string;
  basis: string;
  site_stage: SiteStage;
}

export interface ComposerFinding {
  finding_id: string;
  result_state: "verified" | "inferred" | "not_verified" | "unavailable";
  confidence: "high" | "medium" | "low";
  evidence_ids: string[];
  data: Record<string, unknown>;
  limitations: string[];
}

export interface ComposerAgentOutcome {
  agent_name: string;
  ok: boolean;
  findings: ComposerFinding[];
  limitations: string[];
  cost?: { engine: string; tokens_in: number; tokens_out: number; usd: number };
  unavailable_reason_key?: string;
  data?: Record<string, unknown>;
}

export interface ReportSampleDisclosure {
  pages_checked: number;
  sampled: boolean;
}

export interface ReportModel {
  report_id: string;
  audit_id: string;
  version: number;
  access_class: "anonymous" | "registered";
  languages: string[];
  allowed_projections: string[];
  access: {
    link_id: string;
    secret_hash: string;
    noindex?: boolean;
    public_gallery?: boolean;
  };
  tone: "professional";
  content: {
    summary_bullets: string[];
    score_result_ids: string[];
    finding_ids: string[];
    prompt_run_ids: string[];
    roadmap_id: string | null;
    data_gaps: { metric_key: string; needed_export_key: string }[];
    limitations_keys: string[];
    sample_disclosure: ReportSampleDisclosure;
  };
  lineage_coverage: {
    numbers_total: number;
    numbers_with_lineage: number;
    ratio: number;
  };
  status: "ready";
  needs_native_review: boolean;
  retention_days: number;
  created_at: string;
  expires_at: string | null;
}

export interface StoredReportEnvelope {
  report: ReportModel;
  findings: StoredFinding[];
  unavailable: UnavailableBlock[];
  action_board: StoredActionItem[];
  costs: StoredCosts;
  score: ScoreResult | null;
  /** Absent on reports stored before M10, and on reports with no rule output. */
  recommendations?: StoredRecommendationProvenance;
}
