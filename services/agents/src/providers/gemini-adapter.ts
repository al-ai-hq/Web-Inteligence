import { GoogleGenAI } from "@google/genai";
import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  ToolCall,
} from "./types.js";

export class GeminiAdapter implements ProviderAdapter {
  name = "gemini";
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  isAvailable(): boolean {
    return true;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await this.client.models.generateContent({
      model: request.model,
      contents: request.userPrompt,
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

    const toolCalls: ToolCall[] =
      response.functionCalls?.map((fc) => ({
        name: fc.name ?? "",
        arguments: fc.args ?? {},
      })) ?? [];

    const finishReason = toolCalls.length > 0 ? "tool_use" as const : "stop" as const;

    return {
      content: response.text ?? "",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        tokens_in: response.usageMetadata?.promptTokenCount ?? 0,
        tokens_out: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
      finishReason,
    };
  }
}
