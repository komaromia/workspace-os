import { ActionRegistry, type ActionDefinition } from "../authz/action.js";

export interface PolicyDefinitionProps {
  policyId: string;
  actions: ActionDefinition[];
  /** Defaults to 1 on create; supplied when rehydrating a persisted version. */
  version?: number;
}

export type PolicyRevision = Pick<PolicyDefinitionProps, "actions">;

export class InvalidPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPolicyError";
  }
}

/**
 * A versioned, immutable policy: the set of action classifications and grants
 * the PolicyEngine enforces (Epic 3). Like personas, versions are immutable —
 * revise() bumps the version and leaves the prior one intact — so policy
 * changes are auditable rather than silently mutated, which is exactly what a
 * bank's review board wants to inspect.
 */
export class PolicyDefinition {
  private readonly _policyId: string;
  private readonly _actions: readonly ActionDefinition[];
  private readonly _version: number;

  private constructor(props: Required<PolicyDefinitionProps>) {
    this._policyId = props.policyId;
    this._actions = props.actions.map((action) => ({ ...action }));
    this._version = props.version;
  }

  static create(props: PolicyDefinitionProps): PolicyDefinition {
    if (typeof props.policyId !== "string" || props.policyId.trim() === "") {
      throw new InvalidPolicyError("policyId must be a non-blank string");
    }
    const names = new Set<string>();
    for (const action of props.actions) {
      if (names.has(action.name)) {
        throw new InvalidPolicyError(`duplicate action name: ${action.name}`);
      }
      names.add(action.name);
    }
    const version = props.version ?? 1;
    if (!Number.isInteger(version) || version < 1) {
      throw new InvalidPolicyError(`version must be an integer >= 1, got ${String(version)}`);
    }
    return new PolicyDefinition({ ...props, version });
  }

  get policyId(): string {
    return this._policyId;
  }

  get version(): number {
    return this._version;
  }

  get actions(): ActionDefinition[] {
    return this._actions.map((action) => ({ ...action }));
  }

  toActionRegistry(): ActionRegistry {
    return ActionRegistry.of(this.actions);
  }

  revise(changes: PolicyRevision): PolicyDefinition {
    return PolicyDefinition.create({
      policyId: this._policyId,
      actions: changes.actions,
      version: this._version + 1,
    });
  }

  toJSON(): Required<PolicyDefinitionProps> {
    return {
      policyId: this._policyId,
      actions: this.actions,
      version: this._version,
    };
  }
}
