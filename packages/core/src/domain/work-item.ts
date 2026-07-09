import type { Member, Role } from "./member.js";

export type WorkItemState = "open" | "claimed" | "in_progress" | "blocked" | "done" | "cancelled";

export interface WorkItemProps {
  id: string;
  title: string;
  priority: number;
  description?: string | null;
  requiredRole?: Role | null;
  state?: WorkItemState;
  assigneeMemberId?: string | null;
}

export class InvalidWorkItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWorkItemError";
  }
}

export class WorkItemClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkItemClaimError";
  }
}

export class WorkItemTransitionError extends Error {
  constructor(from: WorkItemState, action: string) {
    super(`cannot ${action} a work item in state "${from}"`);
    this.name = "WorkItemTransitionError";
  }
}

/**
 * A unit of work on the shared board (Epic 5). The same item can be claimed by
 * a human or an agent through the same mechanism — the peer model. Lifecycle
 * transitions are guarded; claim requires the item be open and, if the item is
 * role-gated, that the claimer holds the role. The atomic "exactly-once" claim
 * across concurrent workers is enforced at the database layer (FOR UPDATE SKIP
 * LOCKED); this domain object enforces the per-item invariants.
 */
export class WorkItem {
  private readonly _id: string;
  private readonly _title: string;
  private readonly _priority: number;
  private readonly _description: string | null;
  private readonly _requiredRole: Role | null;
  private readonly _state: WorkItemState;
  private readonly _assigneeMemberId: string | null;

  private constructor(props: Required<WorkItemProps>) {
    this._id = props.id;
    this._title = props.title;
    this._priority = props.priority;
    this._description = props.description;
    this._requiredRole = props.requiredRole;
    this._state = props.state;
    this._assigneeMemberId = props.assigneeMemberId;
  }

  static create(props: WorkItemProps): WorkItem {
    requireNonBlank("id", props.id);
    requireNonBlank("title", props.title);
    if (!Number.isInteger(props.priority)) {
      throw new InvalidWorkItemError(`priority must be an integer, got ${props.priority}`);
    }
    return new WorkItem({
      id: props.id,
      title: props.title,
      priority: props.priority,
      description: props.description ?? null,
      requiredRole: props.requiredRole ?? null,
      state: props.state ?? "open",
      assigneeMemberId: props.assigneeMemberId ?? null,
    });
  }

  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get priority(): number {
    return this._priority;
  }

  get description(): string | null {
    return this._description;
  }

  get requiredRole(): Role | null {
    return this._requiredRole;
  }

  get state(): WorkItemState {
    return this._state;
  }

  get assigneeMemberId(): string | null {
    return this._assigneeMemberId;
  }

  canBeClaimedBy(member: Member): boolean {
    if (this._state !== "open") return false;
    if (this._requiredRole && !member.hasRole(this._requiredRole)) return false;
    return true;
  }

  claimBy(member: Member): WorkItem {
    if (this._state !== "open") {
      throw new WorkItemClaimError(`work item ${this._id} is not open (state: ${this._state})`);
    }
    if (this._requiredRole && !member.hasRole(this._requiredRole)) {
      throw new WorkItemClaimError(
        `member ${member.id} lacks required role "${this._requiredRole}" to claim ${this._id}`,
      );
    }
    return this.with({ state: "claimed", assigneeMemberId: member.id });
  }

  start(): WorkItem {
    if (this._state !== "claimed") throw new WorkItemTransitionError(this._state, "start");
    return this.with({ state: "in_progress" });
  }

  complete(): WorkItem {
    if (this._state !== "in_progress") throw new WorkItemTransitionError(this._state, "complete");
    return this.with({ state: "done" });
  }

  block(_reason?: string): WorkItem {
    if (this._state !== "in_progress") throw new WorkItemTransitionError(this._state, "block");
    return this.with({ state: "blocked" });
  }

  unblock(): WorkItem {
    if (this._state !== "blocked") throw new WorkItemTransitionError(this._state, "unblock");
    return this.with({ state: "in_progress" });
  }

  cancel(): WorkItem {
    if (!["open", "claimed", "in_progress", "blocked"].includes(this._state)) {
      throw new WorkItemTransitionError(this._state, "cancel");
    }
    return this.with({ state: "cancelled" });
  }

  toJSON(): Required<WorkItemProps> {
    return {
      id: this._id,
      title: this._title,
      priority: this._priority,
      description: this._description,
      requiredRole: this._requiredRole,
      state: this._state,
      assigneeMemberId: this._assigneeMemberId,
    };
  }

  private with(changes: Partial<Required<WorkItemProps>>): WorkItem {
    return new WorkItem({ ...this.toJSON(), ...changes });
  }
}

function requireNonBlank(field: string, value: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidWorkItemError(`${field} must be a non-blank string`);
  }
}
