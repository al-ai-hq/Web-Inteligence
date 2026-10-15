// services/agents/tests/providers/perplexity-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  };
});

import { PerplexityAdapter } from "../../src/providers/perplexity-adapter.js";

describe("PerplexityAdapter", () => {
  let adapter: PerplexityAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PerplexityAdapter("test-api-key");
  });

  it("has name set to perplexity", () => {
    expect(adapter.name).toBe("perplexity");
  });

  it("calls Perplexity API and returns completion", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Perplexity answer" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 30, completion_tokens: 15 },
    });

    const result = await adapter.complete({
      model: "sonar-pro",
      systemPrompt: "You are helpful.",
      userPrompt: "What is X?",
    });

    expect(result.content).toBe("Perplexity answer");
    expect(result.usage.tokens_in).toBe(30);
    expect(result.finishReason).toBe("stop");
  });

  it("reports unavailable after 3 failures", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockRejectedValue(new Error("down"));
    for (let i = 0; i < 3; i++) {
      await adapter
        .complete({ model: "sonar-pro", systemPrompt: "t", userPrompt: "t" })
        .catch(() => {});
    }
    expect(adapter.isAvailable()).toBe(false);
  });
});
