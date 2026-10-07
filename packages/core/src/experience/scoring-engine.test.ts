import { describe, it, expect } from 'vitest';
import { calculateDimensionScore } from './scoring-engine.js';

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
