// services/agents/src/providers/perplexity-adapter.ts
import OpenAI from "openai";
import type { ProviderAdapter, CompletionRequest, CompletionResponse } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class PerplexityAdapter implements ProviderAdapter {
  name = "perplexity";
  private client: OpenAI;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.perplexity.ai",
    });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — Perplexity adapter unavailable");
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
      return {
        content: choice?.message?.content ?? "",
        usage: {
          tokens_in: response.usage?.prompt_tokens ?? 0,
          tokens_out: response.usage?.completion_tokens ?? 0,
        },
        finishReason: choice?.finish_reason === "stop" ? "stop" : "error",
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
