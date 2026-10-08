import type { HeadingExtractorOutput } from '../extractors/heading.js';
import type { FormExtractorOutput } from '../extractors/form.js';
import type { ContactExtractorOutput } from '../extractors/contact.js';
import type { PolicyExtractorOutput } from '../extractors/policy.js';
import type { LanguageExtractorOutput } from '../extractors/language.js';
import type { AnalyticsExtractorOutput } from '../extractors/analytics.js';
import type { ViewportExtractorOutput } from '../extractors/viewport.js';
import type { WayfindingExtractorOutput } from '../extractors/wayfinding.js';
import type { CategoryResult } from './readiness.js';

export interface ScreenshotRef {
  url: string;
  width: number;
  height: number;
  label: string;
}

export interface ExperienceEvidencePackage {
  page_url: string;
  language: string;
  market: string;
  business_goal?: string;

  screenshots: {
    viewport: string;
    full_page: string;
    above_fold: string;
  };

  extractor_results: {
    heading: HeadingExtractorOutput;
    form: FormExtractorOutput;
    contact: ContactExtractorOutput;
    policy: PolicyExtractorOutput;
    language: LanguageExtractorOutput;
    analytics: AnalyticsExtractorOutput;
    viewport: ViewportExtractorOutput;
    wayfinding: WayfindingExtractorOutput;
  };

  readiness_results: {
    score: number | null;
    categories: CategoryResult[];
    confidence: 'high' | 'medium' | 'low';
  };
}
