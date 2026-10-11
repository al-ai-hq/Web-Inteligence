import { describe, it, expect } from 'vitest';
import { buildSchema } from '../src/builder.js';

describe('buildSchema', () => {
  it('builds Article schema with required properties', () => {
    const result = buildSchema('Article', {
      headline: 'Test Article',
      author: { name: 'John Doe' },
      datePublished: '2026-10-12',
    });
    expect(result.json_ld['@type']).toBe('Article');
    expect(result.json_ld['headline']).toBe('Test Article');
    expect(result.html_snippet).toContain('application/ld+json');
    expect(result.validation_errors).toHaveLength(0);
  });

  it('builds FAQPage schema', () => {
    const result = buildSchema('FAQPage', {
      mainEntity: [
        { question: 'What?', answer: 'This.' },
      ],
    });
    expect(result.json_ld['@type']).toBe('FAQPage');
  });

  it('returns validation errors for missing required properties', () => {
    const result = buildSchema('Article', {});
    expect(result.validation_errors.length).toBeGreaterThan(0);
  });
});
