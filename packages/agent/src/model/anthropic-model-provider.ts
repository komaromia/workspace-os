import Anthropic from "@anthropic-ai/sdk";
import type {
  ModelCompletionRequest,
  ModelCompletionResult,
  ModelProvider,
} from "@workspace-os/core";

/** The slice of the Anthropic SDK this provider uses. Narrowing to this makes
 * the provider unit-testable with an injected fake — no network, no API key. */
export interface AnthropicClientLike {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      temperature?: number;
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export interface AnthropicModelProviderOptions {
  /** Applied when a request omits maxTokens; the API requires max_tokens. */
  defaultMaxTokens?: number;
}

/**
 * ModelProvider backed by the Anthropic (Claude) API — the real, cloud model
 * for the simple profile. Marked external so the model gateway's no-egress
 * mode refuses it in the hardened profile (where a local/approved model is
 * used instead). System messages are hoisted to the API's top-level `system`
 * param; temperature is forwarded only when set, since the current Claude
 * models reject it.
 */
export class AnthropicModelProvider implements ModelProvider {
  readonly external = true;
  private readonly defaultMaxTokens: number;

  constructor(
    private readonly client: AnthropicClientLike,
    options: AnthropicModelProviderOptions = {},
  ) {
    this.defaultMaxTokens = options.defaultMaxTokens ?? 4096;
  }

  /** Construct with a real Anthropic client from an API key. */
  static fromApiKey(
    apiKey: string,
    options?: AnthropicModelProviderOptions,
  ): AnthropicModelProvider {
    return new AnthropicModelProvider(new Anthropic({ apiKey }) as AnthropicClientLike, options);
  }

  async complete(request: ModelCompletionRequest): Promise<ModelCompletionResult> {
    const system = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const messages = request.messages
      .filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          m.role === "user" || m.role === "assistant",
      )
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
      ...(system !== "" ? { system } : {}),
      messages,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    });

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");

    return {
      content,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
    };
  }
}
