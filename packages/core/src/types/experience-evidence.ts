import type { HeadingExtractorOutput } from "../extractors/heading.js";
import type { FormExtractorOutput } from "../extractors/form.js";
import type { ContactExtractorOutput } from "../extractors/contact.js";
import type { PolicyExtractorOutput } from "../extractors/policy.js";
import type { LanguageExtractorOutput } from "../extractors/language.js";
import type { AnalyticsExtractorOutput } from "../extractors/analytics.js";
import type { ViewportExtractorOutput } from "../extractors/viewport.js";
import type { WayfindingExtractorOutput } from "../extractors/wayfinding.js";
import type { CategoryResult } from "./readiness.js";

export interface ScreenshotRef {
  evidence_id: string;
  path: string;
  mime_type: "image/png";
  width: number;
  height: number;
}

export interface ExperienceEvidencePackage {
  page_url: string;
  language: string;
  market: string;
  business_goal?: string;

  screenshots: {
    viewport: ScreenshotRef | null;
    full_page: ScreenshotRef | null;
    above_fold: ScreenshotRef | null;
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
    confidence: "high" | "medium" | "low";
  };
}
