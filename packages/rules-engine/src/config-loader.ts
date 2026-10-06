import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import { ConfigError, type LoadedRule, type ScoringConfig, type RuleCategory } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ruleSchema = z.object({
  id: z.string(),
  category: z.enum([
    "crawlability",
    "on_page",
    "structured_data",
    "aeo",
    "geo",
    "i18n_accessibility",
    "performance_security",
  ]),
  title: z.string(),
  importance_weight: z.number().int().min(0).max(5),
  scored: z.boolean(),
  evaluation: z.enum(["deterministic", "assessed", "attested"]),
  connected_tier_only: z.boolean().default(false),
  requires_data: z.enum(["keyword_data", "business_profile_or_merchant_center"]).optional(),
  critical_cap: z.string().optional(),
  applicability: z.string(),
  standards: z.object({
    pass: z.string().optional(),
    partial: z.string().optional(),
    fail: z.string().optional(),
    report: z.string().optional(),
  }),
  fidelity_label: z.string(),
});

const ruleFileSchema = z.object({
  rules: z.array(ruleSchema),
});

const scoringRawSchema = z.object({
  methodology_version: z.string(),
  categories: z.record(
    z.object({
      weight: z.number(),
    })
  ),
  rule_results: z.object({
    pass: z.object({ value: z.literal(1.0) }),
    partial: z.object({ value: z.literal(0.5) }),
    fail: z.object({ value: z.literal(0.0) }),
  }),
  critical_caps: z.array(
    z.object({
      id: z.string(),
      max_overall_score: z.number().nullable(),
      related_rule_ids: z.array(z.string()),
    })
  ),
  confidence: z.object({
    levels: z.object({
      high: z.object({ min_coverage: z.number() }),
      medium: z.object({ min_coverage: z.number() }),
    }),
  }),
});

export function loadConfig(): { rules: LoadedRule[]; scoring: ScoringConfig } {
  // Resolve config dir relative to repo root (3 levels up from src/)
  const repoRoot = join(__dirname, "..", "..", "..");
  const configDir = join(repoRoot, "config");
  const ruleFiles = [
    "crawlability.yaml",
    "on-page.yaml",
    "structured-data.yaml",
    "aeo.yaml",
    "geo.yaml",
    "i18n-accessibility.yaml",
    "performance-security.yaml",
  ];

  const rules: LoadedRule[] = [];
  for (const file of ruleFiles) {
    try {
      const content = readFileSync(join(configDir, "rules", file), "utf-8");
      const parsed = parse(content);
      const fileResult = ruleFileSchema.safeParse(parsed);
      if (!fileResult.success) {
        throw new ConfigError(`Invalid rule file ${file}: ${fileResult.error.message}`);
      }
      for (const rule of fileResult.data.rules) {
        rules.push(rule as LoadedRule);
      }
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      throw new ConfigError(`Failed to load ${file}: ${error}`);
    }
  }

  const scoringContent = readFileSync(join(configDir, "scoring.yaml"), "utf-8");
  const scoringParsed = parse(scoringContent);
  const scoringResult = scoringRawSchema.safeParse(scoringParsed);
  if (!scoringResult.success) {
    throw new ConfigError(`Invalid scoring config: ${scoringResult.error.message}`);
  }

  const raw = scoringResult.data;

  // Transform nested category structure into flat Record<RuleCategory, number>
  const categoryWeights: Record<string, number> = {};
  for (const [cat, data] of Object.entries(raw.categories)) {
    categoryWeights[cat] = data.weight;
  }

  const weightSum = Object.values(categoryWeights).reduce((a, b) => a + b, 0);
  if (weightSum !== 100) {
    throw new ConfigError(`Category weights must sum to 100, got ${weightSum}`);
  }

  // Transform critical caps from YAML shape to output shape
  const criticalCaps = raw.critical_caps
    .filter((cap) => cap.max_overall_score !== null)
    .map((cap) => ({
      cap_id: cap.id,
      max_score: cap.max_overall_score as number,
      trigger_rule: cap.related_rule_ids[0] ?? "",
    }));

  // Validate that every active cap has at least one related rule
  for (const cap of raw.critical_caps) {
    if (cap.max_overall_score !== null && cap.related_rule_ids.length === 0) {
      throw new ConfigError(
        `Critical cap "${cap.id}" has max_overall_score set but empty related_rule_ids`,
      );
    }
  }

  const scoring: ScoringConfig = {
    methodology_version: raw.methodology_version,
    category_weights: categoryWeights as Record<RuleCategory, number>,
    result_values: { pass: 1, partial: 0.5, fail: 0 },
    critical_caps: criticalCaps,
    confidence: {
      high_min_coverage: raw.confidence.levels.high.min_coverage as 0.9,
      medium_min_coverage: raw.confidence.levels.medium.min_coverage as 0.7,
    },
  };

  return { rules, scoring };
}

export { ConfigError } from "./types.js";
