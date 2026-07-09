import { describe, expect, it } from "vitest";
import { SessionTokenService } from "./session-token.js";

describe("SessionTokenService", () => {
  const service = new SessionTokenService("test-secret");
  const now = new Date("2026-07-09T12:00:00Z");
  const later = new Date(now.getTime() + 60_000);

  it("issues a token that verifies back to the member id within its lifetime", () => {
    const token = service.issue("m_1", later);

    expect(service.verify(token, now)).toEqual({ memberId: "m_1" });
  });

  it("returns null for an expired token", () => {
    const token = service.issue("m_1", later);

    expect(service.verify(token, new Date(later.getTime() + 1))).toBeNull();
  });

  it("returns null for a token signed with a different secret (tampering)", () => {
    const token = service.issue("m_1", later);
    const attacker = new SessionTokenService("other-secret");

    expect(attacker.verify(token, now)).toBeNull();
  });

  it("returns null when the payload is altered", () => {
    const token = service.issue("m_1", later);
    const [, sig] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "m_admin", exp: later.getTime() }),
    ).toString("base64url");

    expect(service.verify(`${forgedPayload}.${sig}`, now)).toBeNull();
  });

  it("returns null for malformed tokens", () => {
    expect(service.verify("garbage", now)).toBeNull();
    expect(service.verify("", now)).toBeNull();
    expect(service.verify(".", now)).toBeNull();
  });

  it("rejects construction with an empty secret", () => {
    expect(() => new SessionTokenService("")).toThrow();
  });
});
