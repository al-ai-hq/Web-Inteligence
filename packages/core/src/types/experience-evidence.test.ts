import { describe, it, expect } from 'vitest';
import type { ExperienceEvidencePackage } from './experience-evidence.js';

describe('ExperienceEvidencePackage', () => {
  it('should accept valid evidence package with all required fields', () => {
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

    expect(evidence.page_url).toBe('https://example.com');
    expect(evidence.language).toBe('en');
    expect(evidence.screenshots.viewport).toBe('evidence_viewport_001');
  });

  it('should accept optional business_goal field', () => {
    const evidence: ExperienceEvidencePackage = {
      page_url: 'https://example.com',
      language: 'en',
      market: 'US',
      business_goal: 'Increase newsletter signups',
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
        score: null,
        categories: [],
        confidence: 'low',
      },
    };

    expect(evidence.business_goal).toBe('Increase newsletter signups');
  });
});
