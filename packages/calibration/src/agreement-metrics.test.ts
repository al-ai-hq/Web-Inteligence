import { describe, it, expect } from 'vitest';
import { calculateAgreementMetrics } from './agreement-metrics.js';

describe('calculateAgreementMetrics', () => {
  it('should calculate perfect agreement', () => {
    const modelResults = [
      { criterion_id: 'EXP-DH-01', result: 'pass' },
      { criterion_id: 'EXP-DH-02', result: 'partial' },
      { criterion_id: 'EXP-DH-03', result: 'fail' },
    ];

    const humanResults = [
      { criterion_id: 'EXP-DH-01', result: 'pass' },
      { criterion_id: 'EXP-DH-02', result: 'partial' },
      { criterion_id: 'EXP-DH-03', result: 'fail' },
    ];

    const metrics = calculateAgreementMetrics(modelResults, humanResults);

    expect(metrics.exact_match_rate).toBe(1.0);
    expect(metrics.adjacent_match_rate).toBe(1.0);
    expect(metrics.weighted_cohen_kappa).toBe(1.0);
  });

  it('should calculate partial agreement', () => {
    const modelResults = [
      { criterion_id: 'EXP-DH-01', result: 'pass' },
      { criterion_id: 'EXP-DH-02', result: 'partial' },
      { criterion_id: 'EXP-DH-03', result: 'fail' },
      { criterion_id: 'EXP-DH-04', result: 'pass' },
    ];

    const humanResults = [
      { criterion_id: 'EXP-DH-01', result: 'pass' },
      { criterion_id: 'EXP-DH-02', result: 'fail' },
      { criterion_id: 'EXP-DH-03', result: 'fail' },
      { criterion_id: 'EXP-DH-04', result: 'partial' },
    ];

    const metrics = calculateAgreementMetrics(modelResults, humanResults);

    expect(metrics.exact_match_rate).toBe(0.5);
    expect(metrics.adjacent_match_rate).toBe(1.0);
  });
});
