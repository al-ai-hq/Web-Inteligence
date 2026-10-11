import { describe, it, expect } from 'vitest';
import { diffSchema } from '../src/diff-engine.js';

describe('diffSchema', () => {
  it('detects added properties', () => {
    const result = diffSchema(
      { '@type': 'Article', headline: 'Old' },
      { '@type': 'Article', headline: 'Old', author: { name: 'John' } }
    );
    expect(result.added).toContain('author');
  });

  it('detects removed properties', () => {
    const result = diffSchema(
      { '@type': 'Article', headline: 'Old', author: { name: 'John' } },
      { '@type': 'Article', headline: 'Old' }
    );
    expect(result.removed).toContain('author');
  });

  it('detects changed values', () => {
    const result = diffSchema(
      { '@type': 'Article', headline: 'Old' },
      { '@type': 'Article', headline: 'New' }
    );
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]!.path).toBe('headline');
  });
});
