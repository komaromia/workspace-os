import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionClaims {
  memberId: string;
}

/**
 * Issues and verifies stateless HMAC-signed session tokens. Format is
 * `<payloadB64url>.<sigB64url>`, where the payload carries the member id and
 * an expiry. Signed, not encrypted — the payload is readable, so it must never
 * hold secrets, only the member id (which the holder already knows). This is
 * the simple-profile session mechanism; a hardened deployment can swap in the
 * bank's IdP-issued tokens behind the same verify() contract.
 */
export class SessionTokenService {
  constructor(private readonly secret: string) {
    if (!secret || secret.trim() === "") {
      throw new Error("SessionTokenService requires a non-empty secret");
    }
  }

  issue(memberId: string, expiresAt: Date): string {
    const payload = base64url(JSON.stringify({ sub: memberId, exp: expiresAt.getTime() }));
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string, now: Date): SessionClaims | null {
    const dot = token.indexOf(".");
    if (dot <= 0) return null;
    const payload = token.slice(0, dot);
    const signature = token.slice(dot + 1);

    const expected = this.sign(payload);
    if (!safeEqual(signature, expected)) return null;

    let decoded: { sub?: unknown; exp?: unknown };
    try {
      decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (typeof decoded.sub !== "string" || typeof decoded.exp !== "number") return null;
    if (now.getTime() >= decoded.exp) return null;
    return { memberId: decoded.sub };
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
