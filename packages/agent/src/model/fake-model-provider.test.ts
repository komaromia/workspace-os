import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "./fake-model-provider.js";

describe("FakeModelProvider", () => {
  it("echoes the last user message deterministically", async () => {
    const provider = new FakeModelProvider();

    const result = await provider.complete({
      model: "fake",
      messages: [
        { role: "system", content: "be helpful" },
        { role: "user", content: "hello world" },
      ],
    });

    expect(result.content).toBe("echo: hello world");
  });

  it("returns a configured canned response when provided", async () => {
    const provider = new FakeModelProvider({ response: "canned answer" });

    const result = await provider.complete({
      model: "fake",
      messages: [{ role: "user", content: "anything" }],
    });

    expect(result.content).toBe("canned answer");
  });

  it("reports deterministic, non-zero token usage derived from the text", async () => {
    const provider = new FakeModelProvider();

    const a = await provider.complete({
      model: "fake",
      messages: [{ role: "user", content: "one two three" }],
    });
    const b = await provider.complete({
      model: "fake",
      messages: [{ role: "user", content: "one two three" }],
    });

    expect(a.usage.promptTokens).toBeGreaterThan(0);
    expect(a.usage.completionTokens).toBeGreaterThan(0);
    expect(a.usage).toEqual(b.usage);
  });

  it("is not marked external (safe under no-egress)", () => {
    expect(new FakeModelProvider().external).toBe(false);
  });
});
