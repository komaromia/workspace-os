import { describe, expect, it } from "vitest";
import {
  AgentCredential,
  InvalidAgentCredentialError,
  MAX_AGENT_CREDENTIAL_TTL_MS,
} from "./agent-credential.js";

describe("AgentCredential", () => {
  const issuedAt = new Date("2026-07-09T12:00:00Z");
  const base = {
    id: "cred_1",
    agentMemberId: "m_agent_1",
    tokenHash: "hash-abc",
    scopes: ["git.read", "artifact.write"],
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + 15 * 60 * 1000),
  };

  it("constructs a valid credential and exposes its fields", () => {
    const cred = AgentCredential.create(base);

    expect(cred.id).toBe("cred_1");
    expect(cred.agentMemberId).toBe("m_agent_1");
    expect(cred.scopes.sort()).toEqual(["artifact.write", "git.read"]);
    expect(cred.ttlMs()).toBe(15 * 60 * 1000);
  });

  it("reports active vs expired relative to a given time", () => {
    const cred = AgentCredential.create(base);

    expect(cred.isActive(new Date(issuedAt.getTime() + 60_000))).toBe(true);
    expect(cred.isExpired(new Date(issuedAt.getTime() + 60_000))).toBe(false);

    const afterExpiry = new Date(base.expiresAt.getTime() + 1);
    expect(cred.isActive(afterExpiry)).toBe(false);
    expect(cred.isExpired(afterExpiry)).toBe(true);
  });

  it("treats the exact expiry instant as expired (not active)", () => {
    const cred = AgentCredential.create(base);

    expect(cred.isExpired(base.expiresAt)).toBe(true);
    expect(cred.isActive(base.expiresAt)).toBe(false);
  });

  it("checks scopes", () => {
    const cred = AgentCredential.create(base);

    expect(cred.hasScope("git.read")).toBe(true);
    expect(cred.hasScope("git.push")).toBe(false);
    expect(cred.hasAllScopes(["git.read", "artifact.write"])).toBe(true);
    expect(cred.hasAllScopes(["git.read", "git.push"])).toBe(false);
  });

  it("matches a token hash", () => {
    const cred = AgentCredential.create(base);

    expect(cred.matchesTokenHash("hash-abc")).toBe(true);
    expect(cred.matchesTokenHash("hash-xyz")).toBe(false);
  });

  it("rejects a credential whose expiry is not after its issue time", () => {
    expect(() => AgentCredential.create({ ...base, expiresAt: issuedAt })).toThrow(
      InvalidAgentCredentialError,
    );
    expect(() =>
      AgentCredential.create({ ...base, expiresAt: new Date(issuedAt.getTime() - 1) }),
    ).toThrow(InvalidAgentCredentialError);
  });

  it("rejects a credential exceeding the maximum TTL — no long-lived keys", () => {
    const tooLong = new Date(issuedAt.getTime() + MAX_AGENT_CREDENTIAL_TTL_MS + 1);

    expect(() => AgentCredential.create({ ...base, expiresAt: tooLong })).toThrow(
      InvalidAgentCredentialError,
    );
  });

  it("allows a credential exactly at the maximum TTL", () => {
    const atMax = new Date(issuedAt.getTime() + MAX_AGENT_CREDENTIAL_TTL_MS);

    expect(() => AgentCredential.create({ ...base, expiresAt: atMax })).not.toThrow();
  });

  it("allows an empty scope set (least privilege)", () => {
    const cred = AgentCredential.create({ ...base, scopes: [] });

    expect(cred.scopes).toEqual([]);
    expect(cred.hasAllScopes([])).toBe(true);
    expect(cred.hasScope("anything")).toBe(false);
  });

  it("rejects blank id, agentMemberId, or tokenHash", () => {
    expect(() => AgentCredential.create({ ...base, id: "" })).toThrow(InvalidAgentCredentialError);
    expect(() => AgentCredential.create({ ...base, agentMemberId: " " })).toThrow(
      InvalidAgentCredentialError,
    );
    expect(() => AgentCredential.create({ ...base, tokenHash: "" })).toThrow(
      InvalidAgentCredentialError,
    );
  });

  it("exposes scopes as an immutable copy", () => {
    const cred = AgentCredential.create(base);
    cred.scopes.push("git.push");

    expect(cred.hasScope("git.push")).toBe(false);
  });

  it("round-trips through toJSON/create", () => {
    const cred = AgentCredential.create(base);
    const rebuilt = AgentCredential.create(cred.toJSON());

    expect(rebuilt.id).toBe(cred.id);
    expect(rebuilt.expiresAt.getTime()).toBe(cred.expiresAt.getTime());
    expect(rebuilt.scopes.sort()).toEqual(cred.scopes.sort());
  });
});
