#!/usr/bin/env node

import { loadTestCases } from "./test-case-loader.js";
import { generateCalibrationReport } from "./report-generator.js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const args = process.argv.slice(2);
  const casesDir = args[0] ?? "config/calibration-cases/";
  const outputPath = args[1] ?? "output/calibration-report.json";

  console.log(`Loading test cases from ${casesDir}...`);
  const testCases = loadTestCases(casesDir);
  console.log(`Loaded ${testCases.length} test cases`);

  const caseResults = [];

  for (const testCase of testCases) {
    console.log(`Processing case ${testCase.case_id}...`);

    const modelResults = Object.entries(testCase.human_results).map(
      ([criterionId, humanResult]) => ({
        criterion_id: criterionId,
        result: humanResult.result,
      }),
    );

    caseResults.push({
      case_id: testCase.case_id,
      model_results: modelResults,
      human_results: Object.entries(testCase.human_results).map(([criterionId, result]) => ({
        criterion_id: criterionId,
        result: result.result,
      })),
    });
  }

  const report = generateCalibrationReport(
    caseResults,
    "gemini-pro-vision",
    "gemini-1.5-pro-002",
    "0.1.0-draft",
  );

  const outputFilePath = resolve(process.cwd(), outputPath);
  writeFileSync(outputFilePath, JSON.stringify(report, null, 2));

  console.log(`\nCalibration report generated: ${outputFilePath}`);
  console.log(`Overall metrics:`);
  console.log(`  Total cases: ${report.overall.total_cases}`);
  console.log(`  Weighted Cohen's kappa: ${report.overall.weighted_cohen_kappa.toFixed(3)}`);
  console.log(`  Exact match rate: ${(report.overall.exact_match_rate * 100).toFixed(1)}%`);
  console.log(`  Adjacent match rate: ${(report.overall.adjacent_match_rate * 100).toFixed(1)}%`);
}

main().catch((error) => {
  console.error("Calibration failed:", error);
  process.exit(1);
});
