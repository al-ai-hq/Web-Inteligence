import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

import { ClaudeAdapter } from "../../src/providers/claude-adapter.js";

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClaudeAdapter("test-api-key");
  });

  it("has name set to claude", () => {
    expect(adapter.name).toBe("claude");
  });

  it("reports available when circuit breaker is closed", () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it("calls Claude API and returns completion response", async () => {
    const { __mockCreate } = (await import("@anthropic-ai/sdk")) as {
      __mockCreate: ReturnType<typeof vi.fn>;
    };
    __mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Hello from Claude!" }],
      usage: { input_tokens: 20, output_tokens: 10 },
      stop_reason: "end_turn",
    });

    const result = await adapter.complete({
      model: "claude-sonnet-4-20250514",
      systemPrompt: "You are helpful.",
      userPrompt: "Say hello.",
    });

    expect(result.content).toBe("Hello from Claude!");
    expect(result.usage.tokens_in).toBe(20);
    expect(result.usage.tokens_out).toBe(10);
    expect(result.finishReason).toBe("stop");
  });

  it("throws when webSearch is enabled (not supported)", async () => {
    await expect(
      adapter.complete({
        model: "claude-sonnet-4-20250514",
        systemPrompt: "test",
        userPrompt: "test",
        webSearch: { enabled: true },
      }),
    ).rejects.toThrow("web search not supported");
  });

  it("reports unavailable after 3 consecutive failures", async () => {
    const { __mockCreate } = (await import("@anthropic-ai/sdk")) as {
      __mockCreate: ReturnType<typeof vi.fn>;
    };
    __mockCreate.mockRejectedValue(new Error("API down"));

    for (let i = 0; i < 3; i++) {
      await adapter
        .complete({
          model: "claude-sonnet-4-20250514",
          systemPrompt: "test",
          userPrompt: "test",
        })
        .catch(() => {});
    }

    expect(adapter.isAvailable()).toBe(false);
  });
});
