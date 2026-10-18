import { assignBand } from "./recommendation-band.js";
import type {
  IndustryPlaybook,
  RecommendationPriorityItem,
  RecommendationScoringConfig,
} from "./types.js";

/**
 * Apply an industry playbook's per-rule boosts onto already-scored items.
 *
 * The boost is capped by the config so a mis-edited YAML cannot outrank the
 * deterministic scoring, and the band is re-derived from the boosted score.
 */
export function applyPlaybook(
  items: RecommendationPriorityItem[],
  playbook: IndustryPlaybook,
  config: RecommendationScoringConfig,
): RecommendationPriorityItem[] {
  const entryByRule = new Map(playbook.entries.map((entry) => [entry.rule_id, entry]));

  return items.map((item) => {
    const entry = entryByRule.get(item.rule_id);
    if (!entry) return item;

    const boost = Math.max(0, Math.min(entry.boost, config.maxPlaybookBoost));
    const score = item.priority_score + boost;

    return {
      ...item,
      priority_score: score,
      band: assignBand(score, config.bandThresholds),
      playbook_id: playbook.playbook_id,
      playbook_note_key: entry.note_key,
    };
  });
}
