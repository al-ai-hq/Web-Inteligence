import type {
  DisplayBand,
  Horizon,
  PriorityGroup,
  RecommendationBand,
  RecommendationScoringConfig,
} from "./types.js";

export interface RecommendationPresentation {
  band: RecommendationBand;
  group: PriorityGroup;
  horizon: Horizon;
  display_band: DisplayBand;
}

/**
 * Derive every presentation field from one score so a boost cannot leave the
 * band and the group/horizon it is rendered from out of step (M10 spec §bands).
 */
export function assignPresentation(
  score: number,
  thresholds: RecommendationScoringConfig["bandThresholds"],
): RecommendationPresentation {
  const band: RecommendationBand =
    score >= thresholds.quickWin
      ? "quick_win"
      : score >= thresholds.strategic
        ? "strategic"
        : score >= thresholds.fillIn
          ? "fill_in"
          : "defer";

  if (band === "quick_win") {
    return { band, group: "quick_win", horizon: "0-30d", display_band: 1 };
  }
  if (band === "strategic") {
    return { band, group: "strategic_opportunity", horizon: "31-60d", display_band: 2 };
  }
  if (band === "fill_in") {
    return { band, group: "polish", horizon: "31-60d", display_band: 3 };
  }
  return { band, group: "polish", horizon: "61-90d", display_band: 4 };
}
