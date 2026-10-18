import type {
  OutcomeMetric,
  RecommendationOutcome,
  StoredActionItem,
} from "@wpi/audit-pipeline";

/** Metric labels live in the report namespace, next to the score card they match. */
export function measureLabelKey(metric: OutcomeMetric): string {
  return metric === "presence_readiness" ? "score_title" : `score_category_${metric}`;
}

/** Percentage-point change, signed. Null when either audit lacks the metric. */
export function formatDelta(before: number | null, after: number | null): string | null {
  if (before === null || after === null) return null;
  const points = Math.round(after - before);
  return points > 0 ? `+${String(points)}` : String(points);
}

export function pendingOutcomes(rows: RecommendationOutcome[]): RecommendationOutcome[] {
  return rows.filter((row) => row.audit_id_measured === null);
}

export function measuredOutcomes(rows: RecommendationOutcome[]): RecommendationOutcome[] {
  return rows.filter((row) => row.audit_id_measured !== null);
}

export function openQuickWins(
  items: StoredActionItem[],
  appliedTitles: ReadonlySet<string>,
): StoredActionItem[] {
  return items.filter((item) => item.band === "quick_win" && !appliedTitles.has(item.title));
}

export function formatPercentage(value: number): string {
  return `${String(Math.round(value))}%`;
}
