import type {
  ModelCompletionRequest,
  ModelCompletionResult,
  ModelProvider,
} from "@workspace-os/core";

export interface FakeModelProviderOptions {
  /** If set, every completion returns this text; otherwise it echoes the last
   * user message. */
  response?: string;
}

/**
 * A deterministic in-memory ModelProvider for tests and offline development.
 * No network, no egress — the gateway, agent loop, and metering can all be
 * exercised without a real model. Token usage is a stable word-count estimate
 * so metering assertions are reproducible.
 */
export class FakeModelProvider implements ModelProvider {
  /** Never leaves the box, so it is always allowed under no-egress mode. */
  readonly external: boolean = false;

  constructor(private readonly options: FakeModelProviderOptions = {}) {}

  async complete(request: ModelCompletionRequest): Promise<ModelCompletionResult> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const content = this.options.response ?? `echo: ${lastUser?.content ?? ""}`;
    const promptTokens = request.messages.reduce((sum, m) => sum + wordCount(m.content), 0);
    return {
      content,
      usage: { promptTokens, completionTokens: wordCount(content) },
    };
  }
}

function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, words);
}
