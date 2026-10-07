import { describe, it, expect } from 'vitest';
import { ExperienceReviewerAgent } from './experience-reviewer.js';
import type { ExperienceEvidencePackage } from '../types/experience-evidence.js';

describe('ExperienceReviewerAgent', () => {
  it('should create agent with correct name', () => {
    const agent = new ExperienceReviewerAgent();
    expect(agent.name).toBe('experience-reviewer');
  });

  it('should return findings array with reviewer trace', async () => {
    const agent = new ExperienceReviewerAgent();

    const evidence: ExperienceEvidencePackage = {
      page_url: 'https://example.com',
      language: 'en',
      market: 'US',
      screenshots: {
        viewport: 'evidence_viewport_001',
        full_page: 'evidence_fullpage_001',
        above_fold: 'evidence_abovefold_001',
      },
      extractor_results: {
        heading: { title: 'Test', h1_count: 1, hierarchy: [] },
        form: { forms: [], fields: [] },
        contact: { emails: [], phones: [], addresses: [] },
        policy: { privacy: null, terms: null, cookies: null },
        language: { detected: 'en', confidence: 'high' },
        analytics: { has_analytics: true, providers: ['ga4'] },
        viewport: { has_viewport_meta: true, responsive: true },
        wayfinding: { nav_items: [], breadcrumbs: [] },
      },
      readiness_results: {
        score: 75,
        categories: [],
        confidence: 'high',
      },
    };

    const result = await agent.execute(evidence);

    expect(result.findings).toBeDefined();
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);

    const firstFinding = result.findings[0];
    expect(firstFinding.data.reviewer_trace).toBeDefined();
    expect(firstFinding.data.reviewer_trace.rubric_version).toBe('0.1.0-draft');
    expect(firstFinding.data.reviewer_trace.reviewer_type).toBe('model');
  });

  it('should return ExperienceScoreResult in data', async () => {
    const agent = new ExperienceReviewerAgent();

    const evidence: ExperienceEvidencePackage = {
      page_url: 'https://example.com',
      language: 'en',
      market: 'US',
      screenshots: {
        viewport: 'evidence_viewport_001',
        full_page: 'evidence_fullpage_001',
        above_fold: 'evidence_abovefold_001',
      },
      extractor_results: {
        heading: { title: 'Test', h1_count: 1, hierarchy: [] },
        form: { forms: [], fields: [] },
        contact: { emails: [], phones: [], addresses: [] },
        policy: { privacy: null, terms: null, cookies: null },
        language: { detected: 'en', confidence: 'high' },
        analytics: { has_analytics: true, providers: ['ga4'] },
        viewport: { has_viewport_meta: true, responsive: true },
        wayfinding: { nav_items: [], breadcrumbs: [] },
      },
      readiness_results: {
        score: 75,
        categories: [],
        confidence: 'high',
      },
    };

    const result = await agent.execute(evidence);

    expect(result.data.experience_score).toBeDefined();
    expect(result.data.experience_score.experience_effectiveness).toBeGreaterThanOrEqual(0);
    expect(result.data.experience_score.experience_effectiveness).toBeLessThanOrEqual(100);
    expect(result.data.experience_score.confidence).toBeDefined();
  });
});
