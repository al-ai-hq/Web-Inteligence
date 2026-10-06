import type { ScoreResult } from "@wpi/rules-engine";

export type FindingSection = "technical" | "keywords" | "content" | "performance";
export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingState = "verified" | "inferred" | "not_verified";

export const SECTION_BY_AGENT: Record<string, FindingSection> = {
  auditor: "technical",
  "keyword-analyst": "keywords",
  "content-strategist": "content",
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

export interface StoredActionItem {
  title: string;
  detail: string;
  severity: FindingSeverity;
  confidence: "high" | "medium" | "low";
  source_finding_id: string;
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
}

export interface ReportSampleDisclosure {
  pages_checked: number;
  sampled: boolean;
}

export interface ReportModel {
  report_id: string;
  audit_id: string;
  version: number;
  access_class: "anonymous";
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
  expires_at: string;
}

export interface StoredReportEnvelope {
  report: ReportModel;
  findings: StoredFinding[];
  unavailable: UnavailableBlock[];
  action_board: StoredActionItem[];
  costs: StoredCosts;
  score: ScoreResult | null;
}
