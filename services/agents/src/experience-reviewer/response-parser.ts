import type { ReviewerTrace } from "@wpi/core";
import { calculateDimensionScore, loadWeightConfig } from "@wpi/core";

interface DimensionResponse {
  criteria: Array<{
    criterion_id: string;
    result: "pass" | "partial" | "fail" | "not_applicable";
    confidence: "high" | "medium" | "low";
    rationale: string;
  }>;
}

const CRITERION_NAMES: Record<string, string> = {
  "EXP-DH-01": "Visual hierarchy",
  "EXP-DH-02": "Heading structure",
  "EXP-DH-03": "Whitespace and grouping",
  "EXP-DH-04": "Color contrast",
  "EXP-DH-05": "Typography scale",
  "EXP-CP-01": "Headline clarity",
  "EXP-CP-02": "Value proposition",
  "EXP-CP-03": "Call-to-action copy",
  "EXP-CP-04": "Content relevance",
  "EXP-UX-01": "Navigation clarity",
  "EXP-UX-02": "Search visibility",
  "EXP-UX-03": "Mobile responsiveness",
  "EXP-UX-04": "Load time perception",
  "EXP-UX-05": "Interaction feedback",
  "EXP-TP-01": "Trust signals",
  "EXP-TP-02": "Social proof",
  "EXP-TP-03": "Credentials",
  "EXP-TP-04": "Transparency",
  "EXP-TP-05": "Security indicators",
  "EXP-CV-01": "Conversion path clarity",
  "EXP-CV-02": "Form usability",
  "EXP-CV-03": "Contact accessibility",
  "EXP-CV-04": "Measurement setup",
  "EXP-CV-05": "Analytics coverage",
};

export function parseDimensionResponse(
  dimension: string,
  responseText: string,
  language: string,
  market: string,
): { findings: any[]; score: any } {
  let parsed: DimensionResponse;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return createErrorFindings(dimension, language, market);
  }

  const config = loadWeightConfig();
  const criteria = config.criteria[dimension];
  if (!criteria) {
    return { findings: [], score: { score: 0, coverage: 0, confidence: "low" } as any };
  }

  const findings = parsed.criteria.map((c) => ({
    id: `exp_${c.criterion_id}_${Date.now()}`,
    result_state: c.result,
    confidence: c.confidence,
    evidence_ids: ["screenshot_viewport", "screenshot_above_fold"],
    data: {
      reviewer_trace: {
        rubric_version: config.methodology_version,
        criterion_id: c.criterion_id,
        criterion_name: CRITERION_NAMES[c.criterion_id] ?? c.criterion_id,
        result: c.result,
        confidence: c.confidence,
        rationale: c.rationale,
        evidence_ids: ["screenshot_viewport", "screenshot_above_fold"],
        reviewer_type: "model",
        model_id: "gemini-pro-vision",
        model_version: "gemini-2.5-pro",
        language,
        language_direction: language === "ar" ? "rtl" : "ltr",
        market,
        evaluated_at: new Date().toISOString(),
        prompt_version: "0.2.0",
        limitations: [],
      } as ReviewerTrace,
    },
  }));

  const score = calculateDimensionScore(
    findings.map((f) => ({
      criterion_id: f.data.reviewer_trace.criterion_id,
      result: f.data.reviewer_trace.result,
      confidence: f.data.reviewer_trace.confidence,
    })),
    criteria,
  );

  return { findings, score };
}

function createErrorFindings(dimension: string, language: string, market: string) {
  const config = loadWeightConfig();
  const criteria = config.criteria[dimension];
  if (!criteria) {
    return { findings: [], score: { score: 0, coverage: 0, confidence: "low" } as any };
  }

  const findings = Object.keys(criteria).map((criterionId) => ({
    id: `exp_${criterionId}_${Date.now()}`,
    result_state: "error",
    confidence: "low",
    evidence_ids: [],
    data: {
      reviewer_trace: {
        rubric_version: config.methodology_version,
        criterion_id: criterionId,
        criterion_name: CRITERION_NAMES[criterionId] ?? criterionId,
        result: "error",
        confidence: "low",
        rationale: "Failed to parse model response",
        evidence_ids: [],
        reviewer_type: "model",
        model_id: "gemini-pro-vision",
        model_version: "gemini-2.5-pro",
        language,
        language_direction: language === "ar" ? "rtl" : "ltr",
        market,
        evaluated_at: new Date().toISOString(),
        prompt_version: "0.2.0",
        limitations: ["Model response parsing failed"],
      } as ReviewerTrace,
    },
  }));

  const score = calculateDimensionScore(
    findings.map((f) => ({
      criterion_id: f.data.reviewer_trace.criterion_id,
      result: f.data.reviewer_trace.result,
      confidence: f.data.reviewer_trace.confidence,
    })),
    criteria,
  );

  return { findings, score };
}
