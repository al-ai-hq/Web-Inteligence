// services/agents/src/providers/adapter-factory.ts
import type { Engine } from "../visibility/types.js";
import type { ProviderAdapter } from "./types.js";
import { GeminiAdapter } from "./gemini-adapter.js";
import { ClaudeAdapter } from "./claude-adapter.js";
import { OpenAIAdapter } from "./openai-adapter.js";
import { PerplexityAdapter } from "./perplexity-adapter.js";
import { GrokAdapter } from "./grok-adapter.js";

export function createAdapter(engine: Engine, apiKey: string): ProviderAdapter {
  switch (engine) {
    case "gemini":
      return new GeminiAdapter(apiKey);
    case "claude":
      return new ClaudeAdapter(apiKey);
    case "openai":
      return new OpenAIAdapter(apiKey);
    case "perplexity":
      return new PerplexityAdapter(apiKey);
    case "grok":
      return new GrokAdapter(apiKey);
    default:
      throw new Error(`Unknown engine: ${engine}`);
  }
}
