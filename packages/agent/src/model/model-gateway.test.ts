import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "./fake-model-provider.js";
import {
  ModelGateway,
  NoEgressViolationError,
  QuotaExceededError,
  UnknownTaskError,
} from "./model-gateway.js";

function makeGateway(opts?: { noEgress?: boolean; quotaTokensPerMember?: number }) {
  const cheap = new FakeModelProvider({ response: "triaged" });
  const strong = new FakeModelProvider({ response: "coded" });
  const external = new FakeModelProviderThatIsExternal();
  return new ModelGateway({
    providers: {
      cheap: { provider: cheap, external: false },
      strong: { provider: strong, external: false },
      cloud: { provider: external, external: true },
    },
    routing: {
      triage: { providerName: "cheap", model: "cheap-1" },
      coding: { providerName: "strong", model: "strong-1" },
      remote: { providerName: "cloud", model: "cloud-1" },
    },
    noEgress: opts?.noEgress,
    quotaTokensPerMember: opts?.quotaTokensPerMember,
  });
}

class FakeModelProviderThatIsExternal extends FakeModelProvider {
  override readonly external = true;
}

describe("ModelGateway", () => {
  const req = (task: string) => ({
    memberId: "m_1",
    task,
    messages: [{ role: "user" as const, content: "do the thing" }],
  });

  it("routes a task to its configured provider and model", async () => {
    const gateway = makeGateway();

    expect((await gateway.complete(req("triage"))).content).toBe("triaged");
    expect((await gateway.complete(req("coding"))).content).toBe("coded");
  });

  it("denies an unrouted task by default", async () => {
    const gateway = makeGateway();

    await expect(gateway.complete(req("unknown-task"))).rejects.toThrow(UnknownTaskError);
  });

  it("meters token usage per member across calls", async () => {
    const gateway = makeGateway();

    await gateway.complete(req("triage"));
    await gateway.complete(req("coding"));

    const usage = gateway.usageFor("m_1");
    expect(usage.totalTokens).toBe(usage.promptTokens + usage.completionTokens);
    expect(usage.totalTokens).toBeGreaterThan(0);
    expect(gateway.usageFor("someone-else").totalTokens).toBe(0);
  });

  it("refuses an external provider under no-egress mode", async () => {
    const gateway = makeGateway({ noEgress: true });

    await expect(gateway.complete(req("remote"))).rejects.toThrow(NoEgressViolationError);
    // Internal providers still work under no-egress.
    expect((await gateway.complete(req("triage"))).content).toBe("triaged");
  });

  it("allows the external provider when not in no-egress mode", async () => {
    const gateway = makeGateway({ noEgress: false });

    await expect(gateway.complete(req("remote"))).resolves.toBeDefined();
  });

  it("enforces a per-member token quota", async () => {
    const gateway = makeGateway({ quotaTokensPerMember: 1 });

    // First call goes through (quota checked against prior usage, which is 0).
    await gateway.complete(req("triage"));
    // Now usage exceeds the tiny quota, so the next call is refused.
    await expect(gateway.complete(req("triage"))).rejects.toThrow(QuotaExceededError);
  });
});
