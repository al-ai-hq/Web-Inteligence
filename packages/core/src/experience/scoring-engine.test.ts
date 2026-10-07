import { describe, it, expect } from 'vitest';
import { calculateDimensionScore, calculateOverallScore } from './scoring-engine.js';

describe('calculateDimensionScore', () => {
  it('should calculate dimension score with all pass results', () => {
    const findings = [
      { criterion_id: 'EXP-DH-01', result: 'pass', confidence: 'high' },
      { criterion_id: 'EXP-DH-02', result: 'pass', confidence: 'high' },
      { criterion_id: 'EXP-DH-03', result: 'pass', confidence: 'high' },
      { criterion_id: 'EXP-DH-04', result: 'pass', confidence: 'high' },
      { criterion_id: 'EXP-DH-05', result: 'pass', confidence: 'high' },
    ];

    const weights = {
      'EXP-DH-01': 25,
      'EXP-DH-02': 20,
      'EXP-DH-03': 20,
      'EXP-DH-04': 15,
      'EXP-DH-05': 20,
    };

    const result = calculateDimensionScore(findings, weights);

    expect(result.score).toBe(100);
    expect(result.coverage).toBe(1.0);
    expect(result.criteria_count).toBe(5);
    expect(result.applicable_count).toBe(5);
    expect(result.not_applicable_count).toBe(0);
  });

  it('should calculate dimension score with mixed results', () => {
    const findings = [
      { criterion_id: 'EXP-DH-01', result: 'pass', confidence: 'high' },
      { criterion_id: 'EXP-DH-02', result: 'partial', confidence: 'medium' },
      { criterion_id: 'EXP-DH-03', result: 'fail', confidence: 'high' },
      { criterion_id: 'EXP-DH-04', result: 'pass', confidence: 'high' },
      { criterion_id: 'EXP-DH-05', result: 'not_applicable', confidence: 'high' },
    ];

    const weights = {
      'EXP-DH-01': 25,
      'EXP-DH-02': 20,
      'EXP-DH-03': 20,
      'EXP-DH-04': 15,
      'EXP-DH-05': 20,
    };

    const result = calculateDimensionScore(findings, weights);

    // pass=1.0, partial=0.5, fail=0.0, not_applicable=excluded
    // score = 100 * (1.0*25 + 0.5*20 + 0.0*20 + 1.0*15) / (25+20+20+15)
    // score = 100 * (25 + 10 + 0 + 15) / 80 = 100 * 50 / 80 = 62.5
    expect(result.score).toBe(62.5);
    expect(result.coverage).toBe(0.8); // 80/100
    expect(result.applicable_count).toBe(4);
    expect(result.not_applicable_count).toBe(1);
  });

  it('should handle all not_applicable results', () => {
    const findings = [
      { criterion_id: 'EXP-DH-01', result: 'not_applicable', confidence: 'high' },
      { criterion_id: 'EXP-DH-02', result: 'not_applicable', confidence: 'high' },
    ];

    const weights = {
      'EXP-DH-01': 50,
      'EXP-DH-02': 50,
    };

    const result = calculateDimensionScore(findings, weights);

    expect(result.score).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.applicable_count).toBe(0);
    expect(result.not_applicable_count).toBe(2);
  });
});

describe('calculateOverallScore', () => {
  it('should calculate overall score from dimension scores', () => {
    const dimensionScores = {
      design_hierarchy: { score: 80, coverage: 1.0, criteria_count: 5, applicable_count: 5, not_applicable_count: 0 },
      copy_and_positioning_clarity: { score: 90, coverage: 1.0, criteria_count: 4, applicable_count: 4, not_applicable_count: 0 },
      ux_and_navigation: { score: 85, coverage: 1.0, criteria_count: 5, applicable_count: 5, not_applicable_count: 0 },
      trust_and_proof: { score: 75, coverage: 1.0, criteria_count: 5, applicable_count: 5, not_applicable_count: 0 },
      conversion_path_and_measurement: { score: 70, coverage: 1.0, criteria_count: 5, applicable_count: 5, not_applicable_count: 0 },
    };

    const dimensionWeights = {
      design_hierarchy: 20,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = calculateOverallScore(dimensionScores, dimensionWeights, 0.95, 'high');

    // overall = (80*20 + 90*20 + 85*20 + 75*20 + 70*20) / 100
    // overall = (1600 + 1800 + 1700 + 1500 + 1400) / 100 = 8000 / 100 = 80
    expect(result.experience_effectiveness).toBe(80);
    expect(result.confidence).toBe('high');
    expect(result.fidelity_label).toBe('assessed');
  });

  it('should set confidence to medium when coverage is 0.70-0.90', () => {
    const dimensionScores = {
      design_hierarchy: { score: 80, coverage: 1.0, criteria_count: 5, applicable_count: 5, not_applicable_count: 0 },
      copy_and_positioning_clarity: { score: 90, coverage: 1.0, criteria_count: 4, applicable_count: 4, not_applicable_count: 0 },
      ux_and_navigation: { score: 85, coverage: 1.0, criteria_count: 5, applicable_count: 5, not_applicable_count: 0 },
      trust_and_proof: { score: 75, coverage: 1.0, criteria_count: 5, applicable_count: 5, not_applicable_count: 0 },
      conversion_path_and_measurement: { score: 70, coverage: 1.0, criteria_count: 5, applicable_count: 5, not_applicable_count: 0 },
    };

    const dimensionWeights = {
      design_hierarchy: 20,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = calculateOverallScore(dimensionScores, dimensionWeights, 0.80, 'medium');

    expect(result.confidence).toBe('medium');
  });

  it('should set confidence to low when coverage is below 0.70', () => {
    const dimensionScores = {
      design_hierarchy: { score: 80, coverage: 0.5, criteria_count: 5, applicable_count: 3, not_applicable_count: 2 },
      copy_and_positioning_clarity: { score: 90, coverage: 0.5, criteria_count: 4, applicable_count: 2, not_applicable_count: 2 },
      ux_and_navigation: { score: 85, coverage: 0.5, criteria_count: 5, applicable_count: 3, not_applicable_count: 2 },
      trust_and_proof: { score: 75, coverage: 0.5, criteria_count: 5, applicable_count: 3, not_applicable_count: 2 },
      conversion_path_and_measurement: { score: 70, coverage: 0.5, criteria_count: 5, applicable_count: 3, not_applicable_count: 2 },
    };

    const dimensionWeights = {
      design_hierarchy: 20,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = calculateOverallScore(dimensionScores, dimensionWeights, 0.50, 'low');

    expect(result.confidence).toBe('low');
  });
});
