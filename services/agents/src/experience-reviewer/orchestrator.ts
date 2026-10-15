import type { GeminiAdapter } from "../providers/gemini-adapter.js";
import { resolveModel, getModelPricing } from "../providers/model-resolver.js";
import type { CostTracker } from "../providers/cost-tracker.js";
import { buildDimensionPrompt } from "./dimension-prompt.js";
import { parseDimensionResponse } from "./response-parser.js";
import { loadImagesAsContent } from "./image-loader.js";
import { calculateOverallScore, loadWeightConfig } from "@wpi/core";
import type { ExperienceEvidencePackage, ExperienceScoreResult } from "@wpi/core";

export interface OrchestratorDeps {
  adapter: GeminiAdapter;
  costTracker: CostTracker;
  auditId: string;
}

const DIMENSIONS = [
  "design_hierarchy",
  "copy_and_positioning_clarity",
  "ux_and_navigation",
  "trust_and_proof",
  "conversion_path_and_measurement",
];

export async function reviewExperience(
  evidence: ExperienceEvidencePackage,
  deps: OrchestratorDeps,
): Promise<{ findings: any[]; score: ExperienceScoreResult }> {
  const model = resolveModel("vision_capable");
  const pricing = getModelPricing(model);

  const allFindings = [];
  const dimensionScores: Record<string, any> = {};

  for (const dimension of DIMENSIONS) {
    if (!deps.costTracker.canProceed(deps.auditId)) {
      break;
    }

    const imageParts = loadImagesAsContent(evidence.screenshots);
    const prompt = buildDimensionPrompt(dimension, evidence, imageParts);

    const response = await deps.adapter.complete({
      model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: "",
      content: prompt.content,
      temperature: 0.3,
    });

    const tokensIn = response.usage.tokens_in;
    const tokensOut = response.usage.tokens_out;
    const usd = (tokensIn / 1000) * pricing.inputPer1k + (tokensOut / 1000) * pricing.outputPer1k;

    deps.costTracker.record({
      audit_id: deps.auditId,
      agent_name: "experience-reviewer",
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      usd,
    });

    const { findings, score } = parseDimensionResponse(
      dimension,
      response.content,
      evidence.language,
      evidence.market,
    );

    allFindings.push(...findings);
    dimensionScores[dimension] = score;
  }

  const config = loadWeightConfig();
  const dimensionWeights = Object.fromEntries(
    Object.entries(config.dimensions).map(([k, v]) => [k, v.weight]),
  );

  const applicableDimensions = Object.keys(dimensionScores).length;
  const coverage = applicableDimensions / DIMENSIONS.length;
  const confidence =
    applicableDimensions >= 3 ? "high" : applicableDimensions >= 1 ? "medium" : "low";

  const overallScore = calculateOverallScore(
    dimensionScores,
    dimensionWeights,
    coverage,
    confidence,
  );

  return { findings: allFindings, score: overallScore };
}
