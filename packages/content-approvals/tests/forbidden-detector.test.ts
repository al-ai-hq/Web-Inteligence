import { describe, it, expect } from 'vitest';
import { isForbidden } from '../src/forbidden-detector.js';

describe('isForbidden', () => {
  it('detects page deletion', () => {
    const result = isForbidden({ field_name: 'status', new_value: 'deleted' });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('deletion');
  });

  it('detects hidden text (display: none)', () => {
    const result = isForbidden({ field_name: 'css', new_value: 'display: none' });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('Hidden text');
  });

  it('detects hidden text (visibility: hidden)', () => {
    const result = isForbidden({ field_name: 'css', new_value: 'visibility: hidden' });
    expect(result.forbidden).toBe(true);
  });

  it('detects fabricated reviews without evidence', () => {
    const result = isForbidden({ field_name: 'review', new_value: '5 stars', evidence_citation: undefined });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('evidence');
  });

  it('allows reviews with evidence citation', () => {
    const result = isForbidden({ field_name: 'review', new_value: '5 stars', evidence_citation: 'fact-1' });
    expect(result.forbidden).toBe(false);
  });

  it('detects cloaking (different content for search engines)', () => {
    const result = isForbidden({ field_name: 'meta_redirect', new_value: 'url=/admin-only' });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('loaking');
  });

  it('detects link schemes (paid links without rel=sponsored)', () => {
    const result = isForbidden({ field_name: 'content', new_value: '<a href="https://spam.example">buy now</a>' });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('link');
  });

  it('allows links with rel=sponsored', () => {
    const result = isForbidden({ field_name: 'content', new_value: '<a href="https://partner.example" rel="sponsored">partner</a>' });
    expect(result.forbidden).toBe(false);
  });

  it('detects keyword stuffing', () => {
    const result = isForbidden({
      field_name: 'meta_description',
      new_value: 'buy shoes buy shoes buy shoes buy shoes buy shoes buy shoes buy shoes buy shoes',
    });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('keyword');
  });

  it('allows normal changes', () => {
    const result = isForbidden({ field_name: 'title', new_value: 'New Title' });
    expect(result.forbidden).toBe(false);
  });
});
