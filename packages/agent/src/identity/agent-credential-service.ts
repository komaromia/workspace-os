import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AgentCredential, type Member } from "@workspace-os/core";

export interface IssueCredentialInput {
  agent: Member;
  scopes: string[];
  ttlMs: number;
}

export interface IssuedCredential {
  credential: AgentCredential;
  /** The raw token. This is the only moment it exists in plaintext — it is
   * never stored (only its hash is) and must never be logged. */
  token: string;
}

export type CredentialVerificationFailure = "invalid-token" | "expired" | "insufficient-scope";

export class CredentialVerificationError extends Error {
  constructor(public readonly reason: CredentialVerificationFailure) {
    super(`credential verification failed: ${reason}`);
    this.name = "CredentialVerificationError";
  }
}

export class NotAnAgentError extends Error {
  constructor(public readonly memberId: string) {
    super(`credentials may only be issued to agent members, not ${memberId}`);
    this.name = "NotAnAgentError";
  }
}

/**
 * Issues and verifies short-lived, scoped agent credentials (Epic 2). Agents
 * are governed non-human identities: every credential is bound to an agent
 * member, carries an explicit scope set, and expires. Only the token hash is
 * kept; the raw token is returned once at issue time and never persisted.
 */
export class AgentCredentialService {
  issue(input: IssueCredentialInput, now: Date): IssuedCredential {
    if (input.agent.type !== "agent") {
      throw new NotAnAgentError(input.agent.id);
    }
    const token = randomBytes(32).toString("base64url");
    const credential = AgentCredential.create({
      id: randomUUID(),
      agentMemberId: input.agent.id,
      tokenHash: hashToken(token),
      scopes: input.scopes,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + input.ttlMs),
    });
    return { credential, token };
  }

  /**
   * Throws CredentialVerificationError on any failure; returns normally when
   * the token is valid, unexpired, and covers every required scope.
   */
  verify(token: string, credential: AgentCredential, requiredScopes: string[], now: Date): void {
    if (!credential.matchesTokenHash(hashToken(token))) {
      throw new CredentialVerificationError("invalid-token");
    }
    if (credential.isExpired(now)) {
      throw new CredentialVerificationError("expired");
    }
    if (!credential.hasAllScopes(requiredScopes)) {
      throw new CredentialVerificationError("insufficient-scope");
    }
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
