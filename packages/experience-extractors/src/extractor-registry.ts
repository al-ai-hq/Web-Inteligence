import type { EvidencePackage, ExtractionResult, Extractor } from "./types";
import { extractHeadingStructure } from "./heading-extractor";
import { extractFormAnalysis } from "./form-extractor";
import { extractContactLinks } from "./contact-extractor";
import { extractPolicyLinks } from "./policy-extractor";
import { extractLanguageSwitch } from "./language-extractor";
import { extractAnalyticsDetection } from "./analytics-extractor";
import { extractViewportMetrics } from "./viewport-extractor";
import { extractWayfindingCues } from "./wayfinding-extractor";

const extractors: Extractor[] = [
  {
    name: "headingStructure",
    extract: (evidence: EvidencePackage) => Promise.resolve(extractHeadingStructure(evidence)),
  },
  {
    name: "formAnalysis",
    extract: (evidence: EvidencePackage) => Promise.resolve(extractFormAnalysis(evidence)),
  },
  {
    name: "contactLinks",
    extract: (evidence: EvidencePackage) => Promise.resolve(extractContactLinks(evidence)),
  },
  {
    name: "policyLinks",
    extract: (evidence: EvidencePackage) => Promise.resolve(extractPolicyLinks(evidence)),
  },
  {
    name: "languageSwitch",
    extract: (evidence: EvidencePackage) => Promise.resolve(extractLanguageSwitch(evidence)),
  },
  {
    name: "analyticsDetection",
    extract: (evidence: EvidencePackage) => Promise.resolve(extractAnalyticsDetection(evidence)),
  },
  {
    name: "viewportMetrics",
    extract: (evidence: EvidencePackage) => Promise.resolve(extractViewportMetrics(evidence)),
  },
  {
    name: "wayfindingCues",
    extract: (evidence: EvidencePackage) => Promise.resolve(extractWayfindingCues(evidence)),
  },
];

export function getRegisteredExtractors(): Extractor[] {
  return [...extractors];
}

export async function runAllExtractors(evidence: EvidencePackage): Promise<ExtractionResult> {
  const result: ExtractionResult = {};

  for (const extractor of extractors) {
    const extracted = await extractor.extract(evidence);
    (result as Record<string, unknown>)[extractor.name] = extracted;
  }

  return result;
}
