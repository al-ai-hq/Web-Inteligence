import { calculateAgreementMetrics } from './agreement-metrics.js';

interface CaseResult {
  case_id: string;
  model_results: Array<{ criterion_id: string; result: string }>;
  human_results: Array<{ criterion_id: string; result: string }>;
}

interface CalibrationReport {
  generated_at: string;
  model_id: string;
  model_version: string;
  rubric_version: string;
  overall: {
    total_cases: number;
    weighted_cohen_kappa: number;
    exact_match_rate: number;
    adjacent_match_rate: number;
  };
}

export function generateCalibrationReport(
  caseResults: CaseResult[],
  modelId: string,
  modelVersion: string,
  rubricVersion: string
): CalibrationReport {
  let totalExact = 0;
  let totalAdjacent = 0;
  let totalKappa = 0;
  let totalCriteria = 0;

  for (const caseResult of caseResults) {
    const metrics = calculateAgreementMetrics(
      caseResult.model_results as any,
      caseResult.human_results as any
    );

    totalExact += metrics.exact_match_rate * caseResult.model_results.length;
    totalAdjacent += metrics.adjacent_match_rate * caseResult.model_results.length;
    totalKappa += metrics.weighted_cohen_kappa * caseResult.model_results.length;
    totalCriteria += caseResult.model_results.length;
  }

  return {
    generated_at: new Date().toISOString(),
    model_id: modelId,
    model_version: modelVersion,
    rubric_version: rubricVersion,
    overall: {
      total_cases: caseResults.length,
      weighted_cohen_kappa: totalCriteria > 0 ? totalKappa / totalCriteria : 0,
      exact_match_rate: totalCriteria > 0 ? totalExact / totalCriteria : 0,
      adjacent_match_rate: totalCriteria > 0 ? totalAdjacent / totalCriteria : 0,
    },
  };
}
