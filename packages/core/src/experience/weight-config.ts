import { readFileSync, existsSync } from 'node:fs';
import { load } from 'js-yaml';
import { resolve, dirname } from 'node:path';

interface DimensionConfig {
  weight: number;
  title: string;
}

interface WeightConfig {
  methodology_version: string;
  score_name: string;
  display_name: Record<string, string>;
  dimensions: Record<string, DimensionConfig>;
  criteria: Record<string, Record<string, number>>;
}

const CONFIG_RELATIVE_PATH = 'config/experience-effectiveness.yaml';

function resolveConfigPath(): string {
  // Walk up from CWD to find the config file (handles monorepo sub-packages)
  let dir = process.cwd();
  while (true) {
    const candidate = resolve(dir, CONFIG_RELATIVE_PATH);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // Fallback to CWD path (will produce a clear ENOENT error message)
  return resolve(process.cwd(), CONFIG_RELATIVE_PATH);
}

export function loadWeightConfig(): WeightConfig {
  const configPath = resolveConfigPath();
  const fileContent = readFileSync(configPath, 'utf-8');
  const config = load(fileContent) as WeightConfig;

  return config;
}

export function validateWeights(
  weights: Record<string, number>
): { valid: boolean; error?: string } {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);

  if (sum !== 100) {
    return {
      valid: false,
      error: `Weights must sum to 100, got ${sum}`,
    };
  }

  return { valid: true };
}
