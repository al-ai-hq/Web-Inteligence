import { describe, it, expect } from 'vitest';
import { checkDraftGates } from '../src/draft-gates.js';

describe('checkDraftGates', () => {
  it('rejects when brief is not approved', () => {
    const result = checkDraftGates({
      briefStatus: 'draft',
      author: 'John Doe',
      clientInputReceived: true,
      clusterMapped: false,
      monthlyDraftCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('brief');
  });

  it('rejects when no named author', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: '',
      clientInputReceived: true,
      clusterMapped: false,
      monthlyDraftCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('author');
  });

  it('rejects when client input not received', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: 'John Doe',
      clientInputReceived: false,
      clusterMapped: false,
      monthlyDraftCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('client');
  });

  it('rejects when cluster already mapped', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: 'John Doe',
      clientInputReceived: true,
      clusterMapped: true,
      monthlyDraftCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cluster');
  });

  it('rejects when monthly limit reached', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: 'John Doe',
      clientInputReceived: true,
      clusterMapped: false,
      monthlyDraftCount: 8,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('limit');
  });

  it('passes all gates', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: 'John Doe',
      clientInputReceived: true,
      clusterMapped: false,
      monthlyDraftCount: 3,
    });
    expect(result.ok).toBe(true);
  });
});
