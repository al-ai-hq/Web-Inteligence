// services/agents/tests/providers/adapter-factory.test.ts
import { describe, it, expect } from "vitest";
import { createAdapter } from "../../src/providers/adapter-factory.js";

describe("createAdapter", () => {
  it("creates GeminiAdapter for gemini", () => {
    const adapter = createAdapter("gemini", "key");
    expect(adapter.name).toBe("gemini");
  });

  it("creates ClaudeAdapter for claude", () => {
    const adapter = createAdapter("claude", "key");
    expect(adapter.name).toBe("claude");
  });

  it("creates OpenAIAdapter for openai", () => {
    const adapter = createAdapter("openai", "key");
    expect(adapter.name).toBe("openai");
  });

  it("creates PerplexityAdapter for perplexity", () => {
    const adapter = createAdapter("perplexity", "key");
    expect(adapter.name).toBe("perplexity");
  });

  it("creates GrokAdapter for grok", () => {
    const adapter = createAdapter("grok", "key");
    expect(adapter.name).toBe("grok");
  });

  it("throws for unknown engine", () => {
    expect(() => createAdapter("unknown" as any, "key")).toThrow("Unknown engine");
  });
});
