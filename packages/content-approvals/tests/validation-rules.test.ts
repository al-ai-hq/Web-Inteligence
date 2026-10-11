import { describe, it, expect } from 'vitest';
import { validateChangeItem } from '../src/validation-rules.js';

describe('validateChangeItem', () => {
  it('rejects title over 60 characters', () => {
    const result = validateChangeItem({ field_name: 'title', new_value: 'A'.repeat(61) });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('60');
  });

  it('rejects meta description over 160 characters', () => {
    const result = validateChangeItem({ field_name: 'meta_description', new_value: 'A'.repeat(161) });
    expect(result.valid).toBe(false);
  });

  it('rejects H1 over 70 characters', () => {
    const result = validateChangeItem({ field_name: 'h1', new_value: 'A'.repeat(71) });
    expect(result.valid).toBe(false);
  });

  it('accepts valid title', () => {
    const result = validateChangeItem({ field_name: 'title', new_value: 'Valid Title' });
    expect(result.valid).toBe(true);
  });
});
