import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { ExperienceEvidencePackage } from "@wpi/core";

interface CalibrationTestCase {
  case_id: string;
  description: string;
  evidence_package: ExperienceEvidencePackage;
  human_results: Record<
    string,
    {
      result: "pass" | "partial" | "fail" | "not_applicable";
      confidence: "high" | "medium" | "low";
      rationale: string;
    }
  >;
  labelled_by: string;
  labelled_at: string;
  language: string;
  market: string;
  site_type: string;
}

function resolveDirectory(directory: string): string {
  // Walk up from CWD to find the directory (handles monorepo sub-packages)
  let dir = process.cwd();
  while (true) {
    const candidate = resolve(dir, directory);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback (will produce a clear ENOENT error)
  return resolve(process.cwd(), directory);
}

export function loadTestCases(directory: string): CalibrationTestCase[] {
  const dirPath = resolveDirectory(directory);
  const files = readdirSync(dirPath).filter((f) => f.endsWith(".json"));

  const cases: CalibrationTestCase[] = [];

  for (const file of files) {
    const filePath = resolve(dirPath, file);
    const content = readFileSync(filePath, "utf-8");
    const testCase = JSON.parse(content) as CalibrationTestCase;
    cases.push(testCase);
  }

  return cases;
}
