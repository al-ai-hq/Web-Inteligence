// services/agents/tests/providers/grok-adapter.test.ts
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

import { GrokAdapter } from "../../src/providers/grok-adapter.js";

describe("GrokAdapter", () => {
  let adapter: GrokAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GrokAdapter("test-api-key");
  });

  it("has name set to grok", () => {
    expect(adapter.name).toBe("grok");
  });

  it("calls Grok API and returns completion", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Grok answer" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 25, completion_tokens: 12 },
    });

    const result = await adapter.complete({
      model: "grok-3",
      systemPrompt: "You are helpful.",
      userPrompt: "What is X?",
    });

    expect(result.content).toBe("Grok answer");
    expect(result.finishReason).toBe("stop");
  });

  it("reports unavailable after 3 failures", async () => {
    const { __mockCreate } = (await import("openai")) as { __mockCreate: ReturnType<typeof vi.fn> };
    __mockCreate.mockRejectedValue(new Error("down"));
    for (let i = 0; i < 3; i++) {
      await adapter
        .complete({ model: "grok-3", systemPrompt: "t", userPrompt: "t" })
        .catch(() => {});
    }
    expect(adapter.isAvailable()).toBe(false);
  });
});
