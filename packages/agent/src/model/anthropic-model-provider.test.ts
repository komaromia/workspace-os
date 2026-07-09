import { describe, expect, it, vi } from "vitest";
import { AnthropicModelProvider, type AnthropicClientLike } from "./anthropic-model-provider.js";

function fakeClient(impl: AnthropicClientLike["messages"]["create"]): AnthropicClientLike {
  return { messages: { create: impl } };
}

describe("AnthropicModelProvider", () => {
  it("is marked external (blocked under no-egress)", () => {
    const provider = new AnthropicModelProvider(fakeClient(vi.fn()));
    expect(provider.external).toBe(true);
  });

  it("maps a completion request to the SDK and returns text + usage", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Hello there" }],
      usage: { input_tokens: 12, output_tokens: 5 },
    });
    const provider = new AnthropicModelProvider(fakeClient(create));

    const result = await provider.complete({
      model: "claude-sonnet-5",
      messages: [
        { role: "system", content: "Be terse." },
        { role: "user", content: "Hi" },
      ],
      maxTokens: 256,
    });

    expect(result.content).toBe("Hello there");
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 5 });

    const params = create.mock.calls[0]![0];
    expect(params.model).toBe("claude-sonnet-5");
    expect(params.max_tokens).toBe(256);
    // System messages are hoisted to the top-level `system` param.
    expect(params.system).toBe("Be terse.");
    expect(params.messages).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("concatenates multiple text blocks and ignores non-text blocks", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [
        { type: "thinking", thinking: "hmm" },
        { type: "text", text: "part one " },
        { type: "text", text: "part two" },
      ],
      usage: { input_tokens: 1, output_tokens: 2 },
    });
    const provider = new AnthropicModelProvider(fakeClient(create));

    const result = await provider.complete({
      model: "claude-opus-4-8",
      messages: [{ role: "user", content: "go" }],
    });

    expect(result.content).toBe("part one part two");
  });

  it("applies the default max_tokens when the request omits it", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "x" }],
      usage: { input_tokens: 0, output_tokens: 0 },
    });
    const provider = new AnthropicModelProvider(fakeClient(create), { defaultMaxTokens: 4096 });

    await provider.complete({
      model: "claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(create.mock.calls[0]![0].max_tokens).toBe(4096);
  });

  it("passes temperature through only when provided", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "x" }],
      usage: { input_tokens: 0, output_tokens: 0 },
    });
    const provider = new AnthropicModelProvider(fakeClient(create));

    await provider.complete({ model: "m", messages: [{ role: "user", content: "a" }] });
    expect("temperature" in create.mock.calls[0]![0]).toBe(false);

    await provider.complete({
      model: "m",
      messages: [{ role: "user", content: "a" }],
      temperature: 0.2,
    });
    expect(create.mock.calls[1]![0].temperature).toBe(0.2);
  });

  it("omits the system param when there are no system messages", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "x" }],
      usage: { input_tokens: 0, output_tokens: 0 },
    });
    const provider = new AnthropicModelProvider(fakeClient(create));

    await provider.complete({ model: "m", messages: [{ role: "user", content: "a" }] });

    expect(create.mock.calls[0]![0].system).toBeUndefined();
  });
});
