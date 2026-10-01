import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiAdapter } from "../../src/providers/gemini-adapter.js";

vi.mock("@google/genai", () => {
  const mockGenerateContent = vi.fn();
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
    __mockGenerateContent: mockGenerateContent,
  };
});

describe("GeminiAdapter", () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GeminiAdapter("test-api-key");
  });

  it("reports available when circuit breaker is closed", () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it("calls Gemini API and returns completion response", async () => {
    const { __mockGenerateContent } = await import("@google/genai") as { __mockGenerateContent: ReturnType<typeof vi.fn> };
    __mockGenerateContent.mockResolvedValueOnce({
      text: "Hello, world!",
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
      },
      finishReason: "STOP",
    });

    const result = await adapter.complete({
      model: "gemini-2.0-flash",
      systemPrompt: "You are helpful.",
      userPrompt: "Say hello.",
    });

    expect(result.content).toBe("Hello, world!");
    expect(result.usage.tokens_in).toBe(10);
    expect(result.usage.tokens_out).toBe(5);
    expect(result.finishReason).toBe("stop");
  });

  it("returns tool_calls when model requests tool use", async () => {
    const { __mockGenerateContent } = await import("@google/genai") as { __mockGenerateContent: ReturnType<typeof vi.fn> };
    __mockGenerateContent.mockResolvedValueOnce({
      text: "",
      functionCalls: [{ name: "get_evidence", args: { evidence_id: "ev-1" } }],
      usageMetadata: {
        promptTokenCount: 15,
        candidatesTokenCount: 8,
      },
      finishReason: "STOP",
    });

    const result = await adapter.complete({
      model: "gemini-2.0-flash",
      systemPrompt: "You are an auditor.",
      userPrompt: "Analyze.",
      toolDefinitions: [
        { name: "get_evidence", description: "Get evidence", inputSchema: {} },
      ],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]!.name).toBe("get_evidence");
    expect(result.finishReason).toBe("tool_use");
  });

  it("has a name property set to gemini", () => {
    const adapter = new GeminiAdapter("test-api-key");
    expect(adapter.name).toBe("gemini");
  });

  it("reports unavailable when circuit breaker is open", async () => {
    const { __mockGenerateContent } = await import("@google/genai") as { __mockGenerateContent: ReturnType<typeof vi.fn> };
    // Force 3 consecutive failures to open the breaker
    __mockGenerateContent.mockRejectedValue(new Error("API down"));

    for (let i = 0; i < 3; i++) {
      await adapter.complete({
        model: "gemini-2.0-flash",
        systemPrompt: "test",
        userPrompt: "test",
      }).catch(() => {});
    }

    expect(adapter.isAvailable()).toBe(false);
  });

  it("maps MAX_TOKENS finish reason to max_tokens", async () => {
    const { __mockGenerateContent } = await import("@google/genai") as { __mockGenerateContent: ReturnType<typeof vi.fn> };
    __mockGenerateContent.mockResolvedValueOnce({
      text: "Partial response",
      candidates: [{ finishReason: "MAX_TOKENS" }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
      },
    });

    const result = await adapter.complete({
      model: "gemini-2.0-flash",
      systemPrompt: "You are helpful.",
      userPrompt: "Say hello.",
    });

    expect(result.finishReason).toBe("max_tokens");
  });

  it("maps non-STOP finish reason to error", async () => {
    const { __mockGenerateContent } = await import("@google/genai") as { __mockGenerateContent: ReturnType<typeof vi.fn> };
    __mockGenerateContent.mockResolvedValueOnce({
      text: "",
      candidates: [{ finishReason: "SAFETY" }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 0,
      },
    });

    const result = await adapter.complete({
      model: "gemini-2.0-flash",
      systemPrompt: "You are helpful.",
      userPrompt: "Say hello.",
    });

    expect(result.finishReason).toBe("error");
  });
});
