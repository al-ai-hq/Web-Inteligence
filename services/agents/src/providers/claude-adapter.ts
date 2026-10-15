import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, CompletionRequest, CompletionResponse } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class ClaudeAdapter implements ProviderAdapter {
  name = "claude";
  private client: Anthropic;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (request.webSearch?.enabled) {
      throw new Error("Claude: web search not supported");
    }

    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — Claude adapter unavailable");
    }

    try {
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
      });

      this.breaker.recordSuccess();

      const textBlock = response.content.find((b) => b.type === "text");
      const content = textBlock?.type === "text" ? textBlock.text : "";

      const finishReason: CompletionResponse["finishReason"] =
        response.stop_reason === "end_turn"
          ? "stop"
          : response.stop_reason === "max_tokens"
            ? "max_tokens"
            : response.stop_reason === "tool_use"
              ? "tool_use"
              : "error";

      return {
        content,
        usage: {
          tokens_in: response.usage.input_tokens,
          tokens_out: response.usage.output_tokens,
        },
        finishReason,
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
