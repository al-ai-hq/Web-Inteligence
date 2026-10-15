import type { PromptRun, VisibilityMetrics } from "./types.js";

export function computeMetrics(
  runs: PromptRun[],
  totalConfiguredProviders: number,
): VisibilityMetrics {
  const validRuns = runs.filter((r) => r.status === "valid" && r.counted_in_denominator === true);
  const validCount = validRuns.length;
  const smallCell = validCount < 10;

  const mentionRate =
    validCount === 0
      ? null
      : validRuns.filter((r) => r.brand_mentioned === true).length / validCount;

  const brandMentionedRuns = validRuns.filter((r) => r.brand_mentioned === true);
  const recommendationRate =
    brandMentionedRuns.length === 0
      ? null
      : brandMentionedRuns.filter((r) => r.recommended === true).length / brandMentionedRuns.length;

  const domainCitationRate =
    validCount === 0
      ? null
      : validRuns.filter((r) => r.brand_url_cited === true).length / validCount;

  const brandMentionCount = brandMentionedRuns.length;
  const totalMentionCount = validRuns.reduce(
    (sum, r) => sum + (r.brand_mentioned ? 1 : 0) + (r.competitors_mentioned?.length ?? 0),
    0,
  );
  const shareOfMentions = totalMentionCount === 0 ? 0 : brandMentionCount / totalMentionCount;

  const accuracyIssueCount = validRuns.reduce(
    (sum, r) => sum + (r.accuracy_issue_ids?.length ?? 0),
    0,
  );

  const enginesWithValid = new Set(validRuns.map((r) => r.engine));
  const providerCoverage =
    totalConfiguredProviders === 0 ? 0 : enginesWithValid.size / totalConfiguredProviders;

  return {
    mention_rate: mentionRate,
    recommendation_rate: recommendationRate,
    domain_citation_rate: domainCitationRate,
    share_of_observed_mentions: shareOfMentions,
    accuracy_issue_count: accuracyIssueCount,
    provider_coverage: providerCoverage,
    valid_runs: validCount,
    small_cell: smallCell,
  };
}
