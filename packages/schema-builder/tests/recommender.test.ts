import { describe, it, expect } from 'vitest';
import { recommendSchema } from '../src/recommender.js';

describe('recommendSchema', () => {
  it('recommends FAQPage for pages with FAQ headings', () => {
    const result = recommendSchema({
      headings: ['What is X?', 'How does X work?'],
      hasProduct: false,
      hasReviews: false,
    });
    expect(result).toContain('FAQPage');
  });

  it('recommends Product for pages with product data', () => {
    const result = recommendSchema({
      headings: [],
      hasProduct: true,
      hasReviews: false,
    });
    expect(result).toContain('Product');
  });
});
