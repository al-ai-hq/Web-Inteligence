import type { ContentPart } from "../providers/types.js";
import type { ExperienceEvidencePackage } from "@wpi/core";
import { loadWeightConfig } from "@wpi/core";

const CRITERION_DESCRIPTIONS: Record<string, string> = {
  "EXP-DH-01": "Clear visual hierarchy with dominant elements",
  "EXP-DH-02": "Proper heading structure (H1-H6)",
  "EXP-DH-03": "Effective whitespace and visual grouping",
  "EXP-DH-04": "Sufficient color contrast for readability",
  "EXP-DH-05": "Consistent typography scale",
  "EXP-CP-01": "Clear, compelling headline",
  "EXP-CP-02": "Strong value proposition above the fold",
  "EXP-CP-03": "Actionable call-to-action copy",
  "EXP-CP-04": "Content relevance to target audience",
  "EXP-UX-01": "Intuitive navigation structure",
  "EXP-UX-02": "Visible search functionality",
  "EXP-UX-03": "Mobile-responsive layout",
  "EXP-UX-04": "Fast perceived load time",
  "EXP-UX-05": "Clear interaction feedback",
  "EXP-TP-01": "Visible trust signals (certifications, awards)",
  "EXP-TP-02": "Social proof (testimonials, reviews)",
  "EXP-TP-03": "Professional credentials displayed",
  "EXP-TP-04": "Transparent business information",
  "EXP-TP-05": "Security indicators (SSL, privacy)",
  "EXP-CV-01": "Clear conversion path to goal",
  "EXP-CV-02": "User-friendly form design",
  "EXP-CV-03": "Easy contact access",
  "EXP-CV-04": "Analytics and measurement setup",
  "EXP-CV-05": "Comprehensive analytics coverage",
};

export function buildDimensionPrompt(
  dimension: string,
  evidence: ExperienceEvidencePackage,
  imageParts: ContentPart[],
): { systemPrompt: string; content: ContentPart[] } {
  const config = loadWeightConfig();
  const dimensionConfig = config.dimensions[dimension];
  const criteria = config.criteria[dimension];

  if (!dimensionConfig) {
    throw new Error(`Unknown dimension: ${dimension}`);
  }
  if (!criteria) {
    throw new Error(`No criteria configured for dimension: ${dimension}`);
  }

  const systemPrompt = `You are evaluating a webpage's ${dimensionConfig.title}.

Criteria:
${Object.entries(criteria)
  .map(([id, weight]) => `- ${id} (weight: ${weight}): ${CRITERION_DESCRIPTIONS[id] ?? id}`)
  .join("\n")}

For each criterion, respond with:
- result: 'pass', 'partial', 'fail', or 'not_applicable'
- confidence: 'high', 'medium', or 'low'
- rationale: brief explanation (1-2 sentences)

Respond in JSON format:
{
  "criteria": [
    {
      "criterion_id": "EXP-DH-01",
      "result": "pass",
      "confidence": "high",
      "rationale": "..."
    }
  ]
}`;

  const textContent: ContentPart = {
    type: "text",
    text: `URL: ${evidence.page_url}
Language: ${evidence.language}
Market: ${evidence.market}

Extractor results:
${JSON.stringify(evidence.extractor_results, null, 2)}

Evaluate the screenshots based on the criteria above.`,
  };

  return {
    systemPrompt,
    content: [textContent, ...imageParts],
  };
}
