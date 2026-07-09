export interface HumanCredentialRecord {
  memberId: string;
  email: string;
  /** A hash of the password — never the password itself. */
  passwordHash: string;
}

export interface HumanCredentialRepository {
  /** Persist a human's login credential. Rejects a duplicate email. */
  save(record: HumanCredentialRecord): Promise<void>;
  findByEmail(email: string): Promise<HumanCredentialRecord | null>;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor(public readonly email: string) {
    super(`email already registered: ${email}`);
    this.name = "EmailAlreadyRegisteredError";
  }
}
