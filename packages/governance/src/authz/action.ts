/**
 * How much is at stake in an action (Epic 3):
 * - routine: low-impact and reversible — an agent or human may just do it.
 * - consequential: high-impact (merge to production, change access) — a
 *   proposal that a human approves (maker-checker, one approver).
 * - irreversible: money movement, destruction — dual control, two approvers.
 */
export type Consequence = "routine" | "consequential" | "irreversible";

export interface ActionDefinition {
  name: string;
  consequence: Consequence;
  description?: string;
  /**
   * Any-of role gate: if set, the acting member must hold at least one of
   * these roles. Omitted means no role restriction.
   */
  requiredRoles?: string[];
  /**
   * Relationship gate: if set, the acting member must have this relationship
   * to the target resource (e.g. "owner"). The relationships a member has to
   * a resource are supplied per-call; a normalized relationship store (and,
   * at scale, OpenFGA) can back that lookup without changing this contract.
   */
  requiredRelationship?: string;
}

export class ActionRegistry {
  private readonly byName: Map<string, ActionDefinition>;

  constructor(definitions: ActionDefinition[]) {
    this.byName = new Map(definitions.map((def) => [def.name, def]));
  }

  static of(definitions: ActionDefinition[]): ActionRegistry {
    return new ActionRegistry(definitions);
  }

  get(name: string): ActionDefinition | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }
}
