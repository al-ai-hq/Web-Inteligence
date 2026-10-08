import { readFileSync } from 'node:fs';
import { validateWeights } from './weight-config.js';

interface DimensionConfig {
  weight: number;
  title: string;
}

interface WeightConfig {
  dimensions: Record<string, DimensionConfig>;
  criteria: Record<string, Record<string, number>>;
}

interface DimensionOverride {
  weight: number;
  justification: string;
  approved_by: string;
  approved_at: string;
}

interface ProjectOverrides {
  dimensions: Record<string, DimensionOverride>;
  criteria: Record<string, { weight: number; justification: string; approved_by: string; approved_at: string }>;
}

interface OverrideMetadata {
  overrides_applied: boolean;
  validation_warning?: string;
}

export function applyOverrides(
  baseConfig: WeightConfig,
  overrides: ProjectOverrides
): WeightConfig & { metadata: OverrideMetadata } {
  const validation = validateOverrides(overrides);

  if (!validation.valid) {
    return {
      ...baseConfig,
      metadata: {
        overrides_applied: false,
        validation_warning: validation.error,
      },
    };
  }

  const mergedDimensions = { ...baseConfig.dimensions };

  for (const [dimensionName, override] of Object.entries(overrides.dimensions)) {
    if (mergedDimensions[dimensionName]) {
      mergedDimensions[dimensionName] = {
        ...mergedDimensions[dimensionName],
        weight: override.weight,
      };
    }
  }

  const mergedWeights = Object.fromEntries(
    Object.entries(mergedDimensions).map(([k, v]) => [k, v.weight])
  );
  const weightValidation = validateWeights(mergedWeights);

  if (!weightValidation.valid) {
    return {
      ...baseConfig,
      metadata: {
        overrides_applied: false,
        validation_warning: weightValidation.error,
      },
    };
  }

  return {
    dimensions: mergedDimensions,
    criteria: baseConfig.criteria,
    metadata: {
      overrides_applied: true,
    },
  };
}

export function loadProjectOverrides(filePath: string): ProjectOverrides {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as ProjectOverrides;
}

export function validateOverrides(
  overrides: ProjectOverrides
): { valid: boolean; error?: string } {
  for (const [dimensionName, override] of Object.entries(overrides.dimensions)) {
    if (!override.justification || override.justification.trim() === '') {
      return {
        valid: false,
        error: `Override for ${dimensionName} missing justification`,
      };
    }
  }

  return { valid: true };
}
