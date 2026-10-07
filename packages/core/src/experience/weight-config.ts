import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { resolve } from 'node:path';

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

export function loadWeightConfig(): WeightConfig {
  const configPath = resolve(process.cwd(), 'config/experience-effectiveness.yaml');
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
