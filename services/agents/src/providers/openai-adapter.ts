// services/agents/src/providers/openai-adapter.ts
import OpenAI from "openai";
import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
} from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class OpenAIAdapter implements ProviderAdapter {
  name = "openai";
  private client: OpenAI;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — OpenAI adapter unavailable");
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
        temperature: request.temperature,
      });

      this.breaker.recordSuccess();

      const choice = response.choices[0];
      const content = choice?.message?.content ?? "";
      const sdkReason = choice?.finish_reason ?? "";

      const finishReason: CompletionResponse["finishReason"] =
        sdkReason === "stop"
          ? "stop"
          : sdkReason === "length"
            ? "max_tokens"
            : sdkReason === "tool_calls"
              ? "tool_use"
              : "error";

      return {
        content,
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
