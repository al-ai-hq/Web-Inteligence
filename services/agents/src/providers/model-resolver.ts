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
