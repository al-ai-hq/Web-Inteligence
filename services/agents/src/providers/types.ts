export interface ProviderAdapter {
  name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  isAvailable(): boolean;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string };

export interface CompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  content?: ContentPart[];
  toolDefinitions?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: { tokens_in: number; tokens_out: number };
  finishReason: "stop" | "tool_use" | "max_tokens" | "error";
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}
