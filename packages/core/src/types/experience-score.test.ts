import { describe, it, expect } from 'vitest';
import type { ExperienceScoreResult, DimensionScore } from './experience-score.js';

describe('ExperienceScoreResult', () => {
  it('should accept valid experience score result', () => {
    const dimensionScore: DimensionScore = {
      score: 85,
      coverage: 1.0,
      criteria_count: 5,
      applicable_count: 5,
      not_applicable_count: 0,
    };

    const result: ExperienceScoreResult = {
      experience_effectiveness: 82,
      dimensions: {
        design_hierarchy: dimensionScore,
        copy_and_positioning_clarity: dimensionScore,
        ux_and_navigation: dimensionScore,
        trust_and_proof: dimensionScore,
        conversion_path_and_measurement: dimensionScore,
      },
      coverage: 0.95,
      confidence: 'high',
      fidelity_label: 'assessed',
      methodology_version: '0.1.0-draft',
    };

    expect(result.experience_effectiveness).toBe(82);
    expect(result.confidence).toBe('high');
    expect(result.fidelity_label).toBe('assessed');
  });
});
