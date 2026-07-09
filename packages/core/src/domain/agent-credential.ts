/** Agent credentials are deliberately short-lived. One hour is the hard
 * ceiling: agents are governed non-human identities that must re-authenticate,
 * never hold a long-lived static key (Epic 2). */
export const MAX_AGENT_CREDENTIAL_TTL_MS = 60 * 60 * 1000;

export interface AgentCredentialProps {
  id: string;
  agentMemberId: string;
  /** Only the hash of the token is ever stored — the raw token exists solely
   * at issue time and is never persisted or logged. */
  tokenHash: string;
  scopes: string[];
  issuedAt: Date;
  expiresAt: Date;
}

export class InvalidAgentCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAgentCredentialError";
  }
}

export class AgentCredential {
  private readonly _id: string;
  private readonly _agentMemberId: string;
  private readonly _tokenHash: string;
  private readonly _scopes: ReadonlySet<string>;
  private readonly _issuedAt: Date;
  private readonly _expiresAt: Date;

  private constructor(props: AgentCredentialProps) {
    this._id = props.id;
    this._agentMemberId = props.agentMemberId;
    this._tokenHash = props.tokenHash;
    this._scopes = new Set(props.scopes);
    this._issuedAt = props.issuedAt;
    this._expiresAt = props.expiresAt;
  }

  static create(props: AgentCredentialProps): AgentCredential {
    requireNonBlank("id", props.id);
    requireNonBlank("agentMemberId", props.agentMemberId);
    requireNonBlank("tokenHash", props.tokenHash);
    const ttl = props.expiresAt.getTime() - props.issuedAt.getTime();
    if (ttl <= 0) {
      throw new InvalidAgentCredentialError("expiresAt must be after issuedAt");
    }
    if (ttl > MAX_AGENT_CREDENTIAL_TTL_MS) {
      throw new InvalidAgentCredentialError(
        `credential TTL ${ttl}ms exceeds the maximum ${MAX_AGENT_CREDENTIAL_TTL_MS}ms`,
      );
    }
    return new AgentCredential(props);
  }

  get id(): string {
    return this._id;
  }

  get agentMemberId(): string {
    return this._agentMemberId;
  }

  get tokenHash(): string {
    return this._tokenHash;
  }

  get scopes(): string[] {
    return [...this._scopes];
  }

  get issuedAt(): Date {
    return this._issuedAt;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  ttlMs(): number {
    return this._expiresAt.getTime() - this._issuedAt.getTime();
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this._expiresAt.getTime();
  }

  isActive(now: Date): boolean {
    return !this.isExpired(now);
  }

  hasScope(scope: string): boolean {
    return this._scopes.has(scope);
  }

  hasAllScopes(scopes: string[]): boolean {
    return scopes.every((scope) => this._scopes.has(scope));
  }

  matchesTokenHash(tokenHash: string): boolean {
    return this._tokenHash === tokenHash;
  }

  toJSON(): AgentCredentialProps {
    return {
      id: this._id,
      agentMemberId: this._agentMemberId,
      tokenHash: this._tokenHash,
      scopes: [...this._scopes],
      issuedAt: this._issuedAt,
      expiresAt: this._expiresAt,
    };
  }
}

function requireNonBlank(field: string, value: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidAgentCredentialError(`${field} must be a non-blank string`);
  }
}
