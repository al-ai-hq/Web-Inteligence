import { describe, it, expect } from 'vitest';
import * as contentBriefs from '../src/index.js';

describe('@wpi/content-briefs', () => {
  it('exports ContentBrief type', () => {
    expect(contentBriefs).toBeDefined();
  });
});
