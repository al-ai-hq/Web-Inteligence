// services/agents/tests/providers/openai-adapter.test.ts
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

import { OpenAIAdapter } from "../../src/providers/openai-adapter.js";

describe("OpenAIAdapter", () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAIAdapter("test-api-key");
  });

  it("has name set to openai", () => {
    expect(adapter.name).toBe("openai");
  });

  it("calls OpenAI API and returns completion response", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Hello from OpenAI!" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 15, completion_tokens: 8 },
    });

    const result = await adapter.complete({
      model: "gpt-4o",
      systemPrompt: "You are helpful.",
      userPrompt: "Say hello.",
    });

    expect(result.content).toBe("Hello from OpenAI!");
    expect(result.usage.tokens_in).toBe(15);
    expect(result.usage.tokens_out).toBe(8);
    expect(result.finishReason).toBe("stop");
  });

  it("maps length finish reason to max_tokens", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Partial" }, finish_reason: "length" }],
      usage: { prompt_tokens: 10, completion_tokens: 100 },
    });

    const result = await adapter.complete({
      model: "gpt-4o",
      systemPrompt: "test",
      userPrompt: "test",
    });

    expect(result.finishReason).toBe("max_tokens");
  });

  it("reports unavailable after 3 consecutive failures", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockRejectedValue(new Error("API down"));

    for (let i = 0; i < 3; i++) {
      await adapter
        .complete({ model: "gpt-4o", systemPrompt: "t", userPrompt: "t" })
        .catch(() => {});
    }

    expect(adapter.isAvailable()).toBe(false);
  });
});
