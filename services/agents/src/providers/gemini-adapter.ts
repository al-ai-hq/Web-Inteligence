import { GoogleGenAI } from "@google/genai";
import type { Part } from "@google/genai";
import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  ToolCall,
} from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export class GeminiAdapter implements ProviderAdapter {
  name = "gemini";
  private client: GoogleGenAI;
  private breaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.breaker = new CircuitBreaker();
  }

  isAvailable(): boolean {
    return this.breaker.isAvailable();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.breaker.isAvailable()) {
      throw new Error("Circuit breaker is open — Gemini adapter unavailable");
    }

    try {
      const contents: string | Part[] = request.content
        ? request.content.map(part => {
            if (part.type === 'text') {
              return { text: part.text };
            }
            return {
              inlineData: {
                mimeType: part.mimeType,
                data: part.data,
              },
            };
          })
        : request.userPrompt;

      const response = await this.client.models.generateContent({
        model: request.model,
        contents,
        config: {
          systemInstruction: request.systemPrompt,
          ...(request.toolDefinitions
            ? {
                tools: [
                  {
                    functionDeclarations: request.toolDefinitions.map((t) => ({
                      name: t.name,
                      description: t.description,
                      parameters: t.inputSchema,
                    })),
                  },
                ],
              }
            : {}),
          ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        },
      });

      this.breaker.recordSuccess();

      const toolCalls: ToolCall[] =
        response.functionCalls?.map((fc) => ({
          name: fc.name ?? "",
          arguments: fc.args ?? {},
        })) ?? [];

      const sdkFinishReason = response.candidates?.[0]?.finishReason as string | undefined;
      const finishReason: CompletionResponse["finishReason"] =
        toolCalls.length > 0
          ? "tool_use"
          : sdkFinishReason === "MAX_TOKENS"
            ? "max_tokens"
            : sdkFinishReason !== undefined && sdkFinishReason !== "STOP"
              ? "error"
              : "stop";

      return {
        content: response.text ?? "",
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          tokens_in: response.usageMetadata?.promptTokenCount ?? 0,
          tokens_out: response.usageMetadata?.candidatesTokenCount ?? 0,
        },
        finishReason,
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    }
  }
}
