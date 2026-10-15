export interface ReviewerTrace {
  rubric_version: string;
  criterion_id: string;
  criterion_name: string;

  result: "pass" | "partial" | "fail" | "not_applicable" | "unavailable" | "error";
  confidence: "high" | "medium" | "low";
  rationale: string;

  evidence_ids: string[];

  reviewer_type: "model" | "human" | "hybrid";
  model_id?: string;
  model_version?: string;

  language: string;
  language_direction: "ltr" | "rtl";
  market: string;

  evaluated_at: string;
  prompt_version: string;

  override?: {
    original_result: string;
    original_confidence: string;
    original_rationale: string;
    overridden_by: string;
    overridden_at: string;
    override_reason: string;
  };

  limitations: string[];
}
