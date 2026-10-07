interface CriterionResult {
  criterion_id: string;
  result: 'pass' | 'partial' | 'fail' | 'not_applicable';
}

const RESULT_ORDER = ['fail', 'partial', 'pass', 'not_applicable'];

export function calculateAgreementMetrics(
  modelResults: CriterionResult[],
  humanResults: CriterionResult[]
): {
  exact_match_rate: number;
  adjacent_match_rate: number;
  weighted_cohen_kappa: number;
} {
  let exactMatches = 0;
  let adjacentMatches = 0;
  const total = modelResults.length;

  for (let i = 0; i < total; i++) {
    const model = modelResults[i];
    const human = humanResults[i];

    if (model.result === human.result) {
      exactMatches++;
      adjacentMatches++;
    } else {
      const modelIdx = RESULT_ORDER.indexOf(model.result);
      const humanIdx = RESULT_ORDER.indexOf(human.result);

      if (Math.abs(modelIdx - humanIdx) === 1) {
        adjacentMatches++;
      }
    }
  }

  const exactMatchRate = total > 0 ? exactMatches / total : 0;
  const adjacentMatchRate = total > 0 ? adjacentMatches / total : 0;

  const weightedKappa = calculateWeightedKappa(modelResults, humanResults);

  return {
    exact_match_rate: exactMatchRate,
    adjacent_match_rate: adjacentMatchRate,
    weighted_cohen_kappa: weightedKappa,
  };
}

function calculateWeightedKappa(
  modelResults: CriterionResult[],
  humanResults: CriterionResult[]
): number {
  const total = modelResults.length;

  if (total === 0) return 0;

  let observed_agreement = 0;
  for (let i = 0; i < total; i++) {
    if (modelResults[i].result === humanResults[i].result) {
      observed_agreement++;
    }
  }
  observed_agreement /= total;

  const model_dist = calculateDistribution(modelResults);
  const human_dist = calculateDistribution(humanResults);

  let expected_agreement = 0;
  for (const category of RESULT_ORDER) {
    expected_agreement += (model_dist[category] ?? 0) * (human_dist[category] ?? 0);
  }

  if (expected_agreement === 1) return 1;

  return (observed_agreement - expected_agreement) / (1 - expected_agreement);
}

function calculateDistribution(results: CriterionResult[]): Record<string, number> {
  const dist: Record<string, number> = {};
  const total = results.length;

  for (const result of results) {
    dist[result.result] = (dist[result.result] ?? 0) + 1;
  }

  for (const key of Object.keys(dist)) {
    dist[key] /= total;
  }

  return dist;
}
