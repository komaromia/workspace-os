export type ModelMessageRole = "system" | "user" | "assistant" | "tool";

export interface ModelMessage {
  role: ModelMessageRole;
  content: string;
}

export interface ModelCompletionRequest {
  model: string;
  messages: ModelMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ModelCompletionResult {
  content: string;
  usage: ModelUsage;
}

export interface ModelProvider {
  complete(request: ModelCompletionRequest): Promise<ModelCompletionResult>;
}
