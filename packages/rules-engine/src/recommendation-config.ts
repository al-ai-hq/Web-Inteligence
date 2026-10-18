import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import {
  ConfigError,
  type IndustryPlaybook,
  type RecommendationConfig,
  type RuleCategory,
} from "./types.js";

const RULE_CATEGORIES = [
  "crawlability",
  "on_page",
  "structured_data",
  "aeo",
  "geo",
  "i18n_accessibility",
  "performance_security",
] as const;

const scoringYamlSchema = z.object({
  methodology_version: z.string(),
  scoring: z.object({
    formula: z.string(),
    band_thresholds: z.object({
      quick_win: z.number(),
      strategic: z.number(),
      fill_in: z.number(),
    }),
    max_playbook_boost: z.number(),
  }),
  effort_by_category: z.record(z.enum(RULE_CATEGORIES), z.number().int().min(1).max(10)),
  timeline_default_by_category: z.record(z.enum(RULE_CATEGORIES), z.number().int().min(1).max(10)),
});

const playbooksYamlSchema = z.object({
  playbooks: z.array(
    z.object({
      playbook_id: z.string(),
      display_name: z.record(z.string(), z.string()),
      entries: z.array(
        z.object({
          rule_id: z.string(),
          boost: z.number().default(0),
          note_key: z.string().optional(),
        }),
      ),
    }),
  ),
});

/**
 * `loadConfig` in config-loader.ts anchors the repo root a fixed number of levels
 * above src/, which lands one level too high once this file is compiled into dist/.
 * Walking up to the first directory containing the config keeps src and dist in sync.
 */
function findConfigDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, "config", "recommendations");
    if (existsSync(join(candidate, "scoring.yaml"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new ConfigError("Could not locate config/recommendations/scoring.yaml");
    }
    dir = parent;
  }
}

function readYaml(path: string, label: string): unknown {
  try {
    return parse(readFileSync(path, "utf-8"));
  } catch (error) {
    throw new ConfigError(`Failed to read ${label}: ${error}`);
  }
}

export function loadRecommendationConfig(): RecommendationConfig {
  const configDir = findConfigDir();

  const scoringResult = scoringYamlSchema.safeParse(
    readYaml(join(configDir, "scoring.yaml"), "recommendation scoring config"),
  );
  if (!scoringResult.success) {
    throw new ConfigError(
      `Invalid recommendation scoring config: ${scoringResult.error.message}`,
    );
  }

  const playbooksResult = playbooksYamlSchema.safeParse(
    readYaml(join(configDir, "industry-playbooks.yaml"), "industry playbooks config"),
  );
  if (!playbooksResult.success) {
    throw new ConfigError(`Invalid industry playbooks config: ${playbooksResult.error.message}`);
  }

  const scoring = scoringResult.data;

  return {
    scoring: {
      methodology_version: scoring.methodology_version,
      bandThresholds: {
        quickWin: scoring.scoring.band_thresholds.quick_win,
        strategic: scoring.scoring.band_thresholds.strategic,
        fillIn: scoring.scoring.band_thresholds.fill_in,
      },
      maxPlaybookBoost: scoring.scoring.max_playbook_boost,
      effortByCategory: scoring.effort_by_category as Record<RuleCategory, number>,
      timelineDefaultByCategory:
        scoring.timeline_default_by_category as Record<RuleCategory, number>,
    },
    playbooks: playbooksResult.data.playbooks.map(
      (playbook): IndustryPlaybook => ({
        playbook_id: playbook.playbook_id,
        display_name: playbook.display_name,
        entries: playbook.entries.map((entry) => ({
          rule_id: entry.rule_id,
          boost: entry.boost,
          note_key: entry.note_key ?? null,
        })),
      }),
    ),
  };
}
