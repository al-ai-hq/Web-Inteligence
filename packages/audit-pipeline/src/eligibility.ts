import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { EligibilityCounts } from "./secrets.js";

export const TIER_NAMES = ["rich", "reduced", "preview", "refused"] as const;
export type TierName = (typeof TIER_NAMES)[number];

export interface TierScope {
  maxPages: number;
  actionBoardCap: number;
  comparisons: number;
  roadmap: boolean;
  aiVisibilityPanel: boolean;
}

export const TIER_SCOPES: Record<Exclude<TierName, "refused">, TierScope> = {
  rich: {
    maxPages: 20,
    actionBoardCap: 12,
    comparisons: 1,
    roadmap: true,
    aiVisibilityPanel: true,
  },
  reduced: {
    maxPages: 10,
    actionBoardCap: 12,
    comparisons: 0,
    roadmap: false,
    aiVisibilityPanel: false,
  },
  preview: {
    maxPages: 1,
    actionBoardCap: 3,
    comparisons: 0,
    roadmap: false,
    aiVisibilityPanel: false,
  },
};

export function decideTier(counts: EligibilityCounts): Exclude<TierName, "refused"> {
  if (counts.rich_count === 0) return "rich";
  if (counts.reduced_count === 0) return "reduced";
  return "preview";
}

export function loadTierScopes(
  configPath: string,
): Record<Exclude<TierName, "refused">, TierScope> {
  const raw = parseYaml(readFileSync(configPath, "utf-8")) as {
    tiers?: Record<string, { scope?: Record<string, unknown> }>;
  };
  const tiers = raw.tiers;
  if (!tiers) {
    throw new Error(`Invalid eligibility config: missing tiers in ${configPath}`);
  }
  const out = {} as Record<Exclude<TierName, "refused">, TierScope>;
  for (const tier of ["rich", "reduced", "preview"] as const) {
    const scope = tiers[tier]?.scope;
    if (!scope) {
      throw new Error(`Invalid eligibility config: missing scope for tier ${tier}`);
    }
    const panel = scope["ai_visibility_panel"];
    const board = scope["action_board"] as { min?: number; max?: number } | undefined;
    out[tier] = {
      maxPages: scope["max_representative_pages"] as number,
      actionBoardCap: board?.max ?? 0,
      comparisons: scope["comparisons"] as number,
      roadmap: scope["preliminary_roadmap"] === true,
      aiVisibilityPanel: typeof panel === "string" && panel !== "none",
    };
  }
  return out;
}
