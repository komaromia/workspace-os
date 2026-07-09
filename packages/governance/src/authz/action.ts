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
