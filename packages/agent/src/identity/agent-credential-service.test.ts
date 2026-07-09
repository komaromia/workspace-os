import { describe, expect, it } from "vitest";
import { InvalidAgentCredentialError, Member } from "@workspace-os/core";
import {
  AgentCredentialService,
  CredentialVerificationError,
  NotAnAgentError,
} from "./agent-credential-service.js";

describe("AgentCredentialService", () => {
  const service = new AgentCredentialService();
  const now = new Date("2026-07-09T12:00:00Z");

  const agent = Member.create({
    id: "m_agent_1",
    type: "agent",
    identityRef: "cred|a",
    displayName: "Bot",
    roles: ["data-analyst"],
  });
  const human = Member.create({
    id: "m_human_1",
    type: "human",
    identityRef: "oidc|h",
    displayName: "Ada",
    roles: ["engineer"],
  });

  it("issues a credential with a raw token, storing only the hash", () => {
    const { credential, token } = service.issue(
      { agent, scopes: ["git.read"], ttlMs: 15 * 60 * 1000 },
      now,
    );

    expect(token).toBeTruthy();
    expect(credential.agentMemberId).toBe("m_agent_1");
    expect(credential.tokenHash).not.toBe(token);
    expect(credential.tokenHash.length).toBeGreaterThan(0);
    expect(credential.hasScope("git.read")).toBe(true);
    expect(credential.expiresAt.getTime()).toBe(now.getTime() + 15 * 60 * 1000);
  });

  it("verifies a freshly issued token within its lifetime and scopes", () => {
    const { credential, token } = service.issue(
      { agent, scopes: ["git.read", "artifact.write"], ttlMs: 60_000 },
      now,
    );

    expect(() =>
      service.verify(token, credential, ["git.read"], new Date(now.getTime() + 30_000)),
    ).not.toThrow();
  });

  it("rejects a token that does not match the credential", () => {
    const { credential } = service.issue({ agent, scopes: [], ttlMs: 60_000 }, now);

    try {
      service.verify("not-the-token", credential, [], now);
      throw new Error("expected verification to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CredentialVerificationError);
      expect((err as CredentialVerificationError).reason).toBe("invalid-token");
    }
  });

  it("rejects an expired credential", () => {
    const { credential, token } = service.issue({ agent, scopes: [], ttlMs: 60_000 }, now);

    try {
      service.verify(token, credential, [], new Date(now.getTime() + 60_001));
      throw new Error("expected verification to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CredentialVerificationError);
      expect((err as CredentialVerificationError).reason).toBe("expired");
    }
  });

  it("rejects a token missing a required scope", () => {
    const { credential, token } = service.issue(
      { agent, scopes: ["git.read"], ttlMs: 60_000 },
      now,
    );

    try {
      service.verify(token, credential, ["git.push"], now);
      throw new Error("expected verification to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CredentialVerificationError);
      expect((err as CredentialVerificationError).reason).toBe("insufficient-scope");
    }
  });

  it("refuses to issue a credential for a human member", () => {
    expect(() => service.issue({ agent: human, scopes: [], ttlMs: 60_000 }, now)).toThrow(
      NotAnAgentError,
    );
  });

  it("refuses to issue a long-lived credential beyond the maximum TTL", () => {
    expect(() => service.issue({ agent, scopes: [], ttlMs: 24 * 60 * 60 * 1000 }, now)).toThrow(
      InvalidAgentCredentialError,
    );
  });

  it("produces a distinct token and id on each issue", () => {
    const a = service.issue({ agent, scopes: [], ttlMs: 60_000 }, now);
    const b = service.issue({ agent, scopes: [], ttlMs: 60_000 }, now);

    expect(a.token).not.toBe(b.token);
    expect(a.credential.id).not.toBe(b.credential.id);
  });
});
