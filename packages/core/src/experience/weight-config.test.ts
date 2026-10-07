import { describe, it, expect } from 'vitest';
import { loadWeightConfig, validateWeights } from './weight-config.js';

describe('loadWeightConfig', () => {
  it('should load default weight configuration', () => {
    const config = loadWeightConfig();

    expect(config.methodology_version).toBe('0.1.0-draft');
    expect(config.dimensions.design_hierarchy.weight).toBe(20);
    expect(config.criteria.design_hierarchy['EXP-DH-01']).toBe(25);
  });

  it('should have dimension weights summing to 100', () => {
    const config = loadWeightConfig();
    const dimensionWeights = Object.values(config.dimensions).map(d => d.weight);
    const sum = dimensionWeights.reduce((a, b) => a + b, 0);

    expect(sum).toBe(100);
  });

  it('should have criterion weights summing to 100 per dimension', () => {
    const config = loadWeightConfig();

    for (const [dimensionName, criteria] of Object.entries(config.criteria)) {
      const sum = Object.values(criteria).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });
});

describe('validateWeights', () => {
  it('should accept valid dimension weights', () => {
    const weights = {
      design_hierarchy: 20,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = validateWeights(weights);
    expect(result.valid).toBe(true);
  });

  it('should reject dimension weights not summing to 100', () => {
    const weights = {
      design_hierarchy: 25,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = validateWeights(weights);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('sum to 100');
  });
});
