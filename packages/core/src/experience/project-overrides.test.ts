import { describe, it, expect } from 'vitest';
import { applyOverrides, validateOverrides } from './project-overrides.js';

describe('applyOverrides', () => {
  it('should apply valid dimension weight override', () => {
    const baseConfig = {
      dimensions: {
        design_hierarchy: { weight: 20, title: 'Design' },
        copy_and_positioning_clarity: { weight: 20, title: 'Copy' },
        ux_and_navigation: { weight: 20, title: 'UX' },
        trust_and_proof: { weight: 20, title: 'Trust' },
        conversion_path_and_measurement: { weight: 20, title: 'Conversion' },
      },
      criteria: {},
    };

    const overrides = {
      dimensions: {
        conversion_path_and_measurement: {
          weight: 30,
          justification: 'E-commerce prioritizes conversion',
          approved_by: 'seo_lead',
          approved_at: '2026-10-01T12:00:00Z',
        },
        design_hierarchy: {
          weight: 10,
          justification: 'Reduced design weight for e-commerce',
          approved_by: 'seo_lead',
          approved_at: '2026-10-01T12:00:00Z',
        },
      },
      criteria: {},
    };

    const result = applyOverrides(baseConfig, overrides);

    expect(result.dimensions.conversion_path_and_measurement.weight).toBe(30);
    expect(result.metadata.overrides_applied).toBe(true);
  });

  it('should reject invalid override and fall back to defaults', () => {
    const baseConfig = {
      dimensions: {
        design_hierarchy: { weight: 20, title: 'Design' },
        copy_and_positioning_clarity: { weight: 20, title: 'Copy' },
        ux_and_navigation: { weight: 20, title: 'UX' },
        trust_and_proof: { weight: 20, title: 'Trust' },
        conversion_path_and_measurement: { weight: 20, title: 'Conversion' },
      },
      criteria: {},
    };

    const overrides = {
      dimensions: {
        conversion_path_and_measurement: {
          weight: 50,
          justification: 'Invalid override',
          approved_by: 'seo_lead',
          approved_at: '2026-10-01T12:00:00Z',
        },
      },
      criteria: {},
    };

    const result = applyOverrides(baseConfig, overrides);

    expect(result.dimensions.conversion_path_and_measurement.weight).toBe(20);
    expect(result.metadata.overrides_applied).toBe(false);
    expect(result.metadata.validation_warning).toContain('sum to 100');
  });
});

describe('validateOverrides', () => {
  it('should accept valid override with justification', () => {
    const overrides = {
      dimensions: {
        conversion_path_and_measurement: {
          weight: 30,
          justification: 'E-commerce site',
          approved_by: 'seo_lead',
          approved_at: '2026-10-01T12:00:00Z',
        },
      },
      criteria: {},
    };

    const result = validateOverrides(overrides);
    expect(result.valid).toBe(true);
  });

  it('should reject override without justification', () => {
    const overrides = {
      dimensions: {
        conversion_path_and_measurement: {
          weight: 30,
          justification: '',
          approved_by: 'seo_lead',
          approved_at: '2026-10-01T12:00:00Z',
        },
      },
      criteria: {},
    };

    const result = validateOverrides(overrides);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('justification');
  });
});
