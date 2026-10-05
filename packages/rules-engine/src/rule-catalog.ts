import type { LoadedRule } from "./types.js";

export class RuleCatalog {
  private readonly rules: LoadedRule[];

  constructor(rules: LoadedRule[]) {
    this.rules = rules;
  }

  getApplicableRules(tier: "rich" | "reduced" | "preview", locale: "en" | "ar"): LoadedRule[] {
    return this.rules.filter((rule) => {
      // Exclude connected-tier-only rules for preview tier
      if (tier === "preview" && rule.connected_tier_only) {
        return false;
      }

      // Exclude rules requiring unavailable data sources in M2
      if (rule.requires_data) {
        // M2: no keyword_data or business_profile features yet
        return false;
      }

      return true;
    });
  }

  getAllRules(): LoadedRule[] {
    return [...this.rules];
  }
}
