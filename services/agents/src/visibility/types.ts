export type Engine = "gemini" | "claude" | "openai" | "perplexity" | "grok";

export type PromptRunStatus =
  | "queued"
  | "running"
  | "valid"
  | "error"
  | "timeout"
  | "refused"
  | "skipped_budget"
  | "skipped_breaker";

export type PanelRunState =
  | "APPROVED"
  | "BUILDING_PROMPTS"
  | "RUNNING"
  | "ANALYZING"
  | "COMPLETE"
  | "PARTIAL";

export type OwnerClass = "owned" | "competitor" | "third_party" | "unknown";

export type AccuracyIssueType =
  | "price"
  | "availability"
  | "location"
  | "service"
  | "ownership"
  | "founder"
  | "policy"
  | "contact"
  | "hours"
  | "claim"
  | "other";

export type AccuracyIssueStatus =
  | "open"
  | "correction_planned"
  | "owned_source_corrected"
  | "third_party_request_sent"
  | "recheck_resolved"
  | "recheck_persisting"
  | "escalated"
  | "dismissed";

export type EscalationReason =
  | "legal"
  | "defamation"
  | "trademark"
  | "fraud"
  | "disputed_claim"
  | "wikipedia_wikidata";

export type CapCheckDecision =
  | "allowed"
  | "allowed_soft_cap_reached"
  | "denied_audit_hard_cap"
  | "denied_monthly_cap"
  | "denied_breaker_open";

export type PromptFamily =
  | "discovery"
  | "comparison"
  | "branded"
  | "citation"
  | "recommendation"
  | "how_to_choose"
  | "price"
  | "local"
  | "brand_facts";

export interface MentionSpan {
  start: number;
  end: number;
  text: string;
}

export interface PromptRunLineage {
  prompt_template_id: string;
  seed_ref: string | null;
}

export interface PromptRun {
  run_id: string;
  panel_run_id: string;
  audit_id: string;
  prompt_set_id: string;
  prompt_id: string;
  prompt_family: string;
  final_prompt: string;
  repeat_index: number;
  engine: Engine;
  model_id: string;
  market: string;
  language: "ar" | "en";
  location: string | null;
  authentication_state: string;
  started_at: Date;
  completed_at: Date;
  status: PromptRunStatus;
  error_class: string | null;
  counted_in_denominator: boolean | null;
  response_evidence_id: string | null;
  brand_mentioned: boolean | null;
  mention_spans: MentionSpan[];
  recommended: boolean | null;
  brand_url_cited: boolean | null;
  match_confidence: number | null;
  competitors_mentioned: string[];
  cited_urls: string[];
  citation_ids: string[];
  accuracy_issue_ids: string[];
  injection_suspected: boolean;
  analysis_method: string;
  lineage: PromptRunLineage;
}

export interface PromptPanelRun {
  panel_run_id: string;
  audit_id: string;
  prompt_set_id: string;
  project_id?: string;
  state: PanelRunState;
  planned_runs: number;
  valid_runs: number;
  failed_runs: number;
  skipped_runs: number;
  recheck_of_panel_run_id?: string;
  approved_by_user_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PromptTemplateEntry {
  id: string;
  panel: "free" | "connected";
  group?: string;
  category?: string;
  branded: boolean;
  text: string;
  placeholders: string[];
  source_reference?: string;
  needs_native_review?: boolean;
}

export interface PromptSet {
  prompt_set_id: string;
  purpose: "anonymous_audit" | "connected_panel" | "recheck";
  prompts: PromptTemplateEntry[];
  engines: { engine: Engine; included: boolean; omission_reason?: string }[];
  repeats: number;
  status: "draft" | "approved" | "retired";
}

export interface Citation {
  citation_id: string;
  url: string;
  owner_class: OwnerClass;
  position: number | null;
  in_final_answer: boolean;
  fetched_evidence_id: string | null;
}

export interface AccuracyIssueEscalation {
  required: boolean;
  reason: EscalationReason;
  owner_user_id: string | null;
}

export interface AccuracyIssue {
  issue_id: string;
  run_id: string;
  issue_type: AccuracyIssueType;
  claim: string;
  status: AccuracyIssueStatus;
  escalation: AccuracyIssueEscalation | null;
}

export interface BrandFact {
  claim: string;
  category: string;
}

export interface VisibilityIntake {
  brand_name: string;
  offering_description: string;
  target_audience: string;
  market: string;
  category: string;
  city: string | null;
  use_case: string | null;
  requirement: string | null;
  brand_domain: string;
  competitor_domains: string[];
  brand_aliases: string[];
  brand_facts: BrandFact[];
}

export interface VisibilityMetrics {
  mention_rate: number | null;
  recommendation_rate: number | null;
  domain_citation_rate: number | null;
  share_of_observed_mentions: number;
  accuracy_issue_count: number;
  provider_coverage: number;
  valid_runs: number;
  small_cell: boolean;
}

export interface PanelRunResult {
  panel_run: PromptPanelRun;
  runs: PromptRun[];
  citations: Citation[];
  accuracy_issues: AccuracyIssue[];
  metrics: VisibilityMetrics;
}

export interface LostPrompt {
  prompt_id: string;
  prompt_text: string;
  competitor_cited_urls: string[];
  gap_note: string;
  recheck_after: Date;
}
