import type { PolicyDefinition } from "./policy-definition.js";

export interface PolicyRepository {
  /**
   * Persist a policy version. Versions are immutable, so saving a
   * (policyId, version) that already exists is a conflict, not an update.
   */
  saveVersion(policy: PolicyDefinition): Promise<void>;
  findVersion(policyId: string, version: number): Promise<PolicyDefinition | null>;
  /** The highest-versioned policy for the given id, or null if none. */
  findLatest(policyId: string): Promise<PolicyDefinition | null>;
}

export class PolicyVersionConflictError extends Error {
  constructor(
    public readonly policyId: string,
    public readonly version: number,
  ) {
    super(`policy ${policyId} version ${version} already exists (versions are immutable)`);
    this.name = "PolicyVersionConflictError";
  }
}
