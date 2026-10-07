import type { DimensionScore, ExperienceScoreResult } from '../types/experience-score.js';

interface Finding {
  criterion_id: string;
  result: 'pass' | 'partial' | 'fail' | 'not_applicable' | 'unavailable' | 'error';
  confidence: 'high' | 'medium' | 'low';
}

const RESULT_VALUES: Record<string, number> = {
  pass: 1.0,
  partial: 0.5,
  fail: 0.0,
};

export function calculateDimensionScore(
  findings: Finding[],
  weights: Record<string, number>
): DimensionScore {
  let totalWeight = 0;
  let applicableWeight = 0;
  let weightedSum = 0;
  let applicableCount = 0;
  let notApplicableCount = 0;

  for (const finding of findings) {
    const weight = weights[finding.criterion_id] ?? 0;
    totalWeight += weight;

    if (finding.result === 'not_applicable') {
      notApplicableCount++;
      continue;
    }

    if (finding.result === 'unavailable' || finding.result === 'error') {
      continue;
    }

    applicableWeight += weight;
    applicableCount++;

    const resultValue = RESULT_VALUES[finding.result] ?? 0;
    weightedSum += resultValue * weight;
  }

  const coverage = totalWeight > 0 ? applicableWeight / totalWeight : 0;
  const score = applicableWeight > 0 ? 100 * weightedSum / applicableWeight : 0;

  return {
    score,
    coverage,
    criteria_count: findings.length,
    applicable_count: applicableCount,
    not_applicable_count: notApplicableCount,
  };
}

export function calculateOverallScore(
  dimensionScores: Record<string, DimensionScore>,
  dimensionWeights: Record<string, number>,
  coverage: number,
  confidence: 'high' | 'medium' | 'low'
): ExperienceScoreResult {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [dimensionName, score] of Object.entries(dimensionScores)) {
    const weight = dimensionWeights[dimensionName] ?? 0;
    weightedSum += score.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    experience_effectiveness: overallScore,
    dimensions: dimensionScores as ExperienceScoreResult['dimensions'],
    coverage,
    confidence,
    fidelity_label: 'assessed',
    methodology_version: '0.1.0-draft',
  };
}
