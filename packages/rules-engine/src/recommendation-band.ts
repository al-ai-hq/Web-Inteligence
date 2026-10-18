import type { RecommendationBand, RecommendationScoringConfig } from "./types.js";

/** Map a priority score onto its outcome band (M10 spec FR-2). */
export function assignBand(
  score: number,
  thresholds: RecommendationScoringConfig["bandThresholds"],
): RecommendationBand {
  if (score >= thresholds.quickWin) return "quick_win";
  if (score >= thresholds.strategic) return "strategic";
  if (score >= thresholds.fillIn) return "fill_in";
  return "defer";
}

/** Board ordering: Quick Win -> Strategic -> Fill-In -> Defer. */
const BAND_RANK: Record<RecommendationBand, number> = {
  quick_win: 0,
  strategic: 1,
  fill_in: 2,
  defer: 3,
};

export function compareByBand(a: RecommendationBand, b: RecommendationBand): number {
  return BAND_RANK[a] - BAND_RANK[b];
}
