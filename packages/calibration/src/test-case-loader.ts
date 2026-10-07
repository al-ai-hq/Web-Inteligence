import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExperienceEvidencePackage } from '../../core/src/types/experience-evidence.js';

interface CalibrationTestCase {
  case_id: string;
  description: string;
  evidence_package: ExperienceEvidencePackage;
  human_results: Record<string, {
    result: 'pass' | 'partial' | 'fail' | 'not_applicable';
    confidence: 'high' | 'medium' | 'low';
    rationale: string;
  }>;
  labelled_by: string;
  labelled_at: string;
  language: string;
  market: string;
  site_type: string;
}

export function loadTestCases(directory: string): CalibrationTestCase[] {
  const dirPath = resolve(process.cwd(), directory);
  const files = readdirSync(dirPath).filter(f => f.endsWith('.json'));

  const cases: CalibrationTestCase[] = [];

  for (const file of files) {
    const filePath = resolve(dirPath, file);
    const content = readFileSync(filePath, 'utf-8');
    const testCase = JSON.parse(content) as CalibrationTestCase;
    cases.push(testCase);
  }

  return cases;
}
