const MODEL_MAP: Record<string, string> = {
  fast: "gemini-2.0-flash",
  fast_plus_embedding: "gemini-2.5-flash",
  strong_reasoning: "gemini-2.5-pro",
};

export function resolveModel(tier: string): string {
  const model = MODEL_MAP[tier];
  if (!model) {
    throw new Error(`Unknown model tier: ${tier}. Known tiers: ${Object.keys(MODEL_MAP).join(", ")}`);
  }
  return model;
}

export interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
}

const FLASH_PRICING: ModelPricing = { inputPer1k: 0.000075, outputPer1k: 0.0003 };

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-2.0-flash": FLASH_PRICING,
  "gemini-2.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.01 },
};

export function getModelPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? FLASH_PRICING;
}
