import { describe, it, expect } from 'vitest';
import type { ReviewerTrace } from './reviewer-trace.js';

describe('ReviewerTrace', () => {
  it('should accept valid reviewer trace without override', () => {
    const trace: ReviewerTrace = {
      rubric_version: '0.1.0-draft',
      criterion_id: 'EXP-DH-01',
      criterion_name: 'Visual hierarchy clarity',
      result: 'pass',
      confidence: 'high',
      rationale: 'Clear visual hierarchy with distinct heading levels',
      evidence_ids: ['screenshot_viewport', 'extractor_heading'],
      reviewer_type: 'model',
      model_id: 'gemini-pro-vision',
      model_version: 'gemini-1.5-pro-002',
      language: 'en',
      language_direction: 'ltr',
      market: 'US',
      evaluated_at: '2026-10-07T12:00:00Z',
      prompt_version: '0.1.0',
      limitations: [],
    };

    expect(trace.criterion_id).toBe('EXP-DH-01');
    expect(trace.reviewer_type).toBe('model');
    expect(trace.override).toBeUndefined();
  });

  it('should accept reviewer trace with override', () => {
    const trace: ReviewerTrace = {
      rubric_version: '0.1.0-draft',
      criterion_id: 'EXP-CP-01',
      criterion_name: 'Value proposition clarity',
      result: 'partial',
      confidence: 'medium',
      rationale: 'Value proposition is present but could be clearer',
      evidence_ids: ['screenshot_above_fold'],
      reviewer_type: 'hybrid',
      model_id: 'gemini-pro-vision',
      model_version: 'gemini-1.5-pro-002',
      language: 'en',
      language_direction: 'ltr',
      market: 'US',
      evaluated_at: '2026-10-07T12:00:00Z',
      prompt_version: '0.1.0',
      override: {
        original_result: 'pass',
        original_confidence: 'high',
        original_rationale: 'Value proposition is clear',
        overridden_by: 'calibration_reviewer',
        overridden_at: '2026-10-07T13:00:00Z',
        override_reason: 'Value proposition lacks specificity',
      },
      limitations: [],
    };

    expect(trace.reviewer_type).toBe('hybrid');
    expect(trace.override).toBeDefined();
    expect(trace.override?.original_result).toBe('pass');
  });
});
