// services/agents/src/providers/grok-adapter.ts
import OpenAI from "openai";
import type { ProviderAdapter, CompletionRequest, CompletionResponse } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class GrokAdapter implements ProviderAdapter {
  name = "grok";
  private client: OpenAI;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
    });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — Grok adapter unavailable");
    }

    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (request.systemPrompt) {
        messages.push({ role: "system", content: request.systemPrompt });
      }
      messages.push({ role: "user", content: request.userPrompt });

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        max_tokens: request.maxTokens ?? 1024,
      });

      this.breaker.recordSuccess();

      const choice = response.choices[0];
      const sdkReason = choice?.finish_reason ?? "";
      const finishReason: CompletionResponse["finishReason"] =
        sdkReason === "stop" ? "stop" : sdkReason === "length" ? "max_tokens" : "error";

      return {
        content: choice?.message?.content ?? "",
        usage: {
          tokens_in: response.usage?.prompt_tokens ?? 0,
          tokens_out: response.usage?.completion_tokens ?? 0,
        },
        finishReason,
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
