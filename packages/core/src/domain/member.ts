export type MemberType = "human" | "agent";

export type Role = string;

export interface MemberProps {
  id: string;
  type: MemberType;
  identityRef: string;
  displayName: string;
  roles: Role[];
}

export class InvalidMemberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMemberError";
  }
}

const MEMBER_TYPES: readonly MemberType[] = ["human", "agent"];

/**
 * A Member is the single first-class principal in the workspace: a human and
 * an agent are the same kind of thing (Epic 2's "peers as a data-model
 * decision"). Anything downstream — claiming work, authoring artifacts,
 * attending meetings — operates on Member, never on a human/agent fork.
 */
export class Member {
  private readonly _id: string;
  private readonly _type: MemberType;
  private readonly _identityRef: string;
  private readonly _displayName: string;
  private readonly _roles: ReadonlySet<Role>;

  private constructor(props: MemberProps) {
    this._id = props.id;
    this._type = props.type;
    this._identityRef = props.identityRef;
    this._displayName = props.displayName;
    this._roles = new Set(props.roles);
  }

  static create(props: MemberProps): Member {
    if (!MEMBER_TYPES.includes(props.type)) {
      throw new InvalidMemberError(`unknown member type: ${String(props.type)}`);
    }
    requireNonBlank("id", props.id);
    requireNonBlank("identityRef", props.identityRef);
    requireNonBlank("displayName", props.displayName);
    return new Member(props);
  }

  get id(): string {
    return this._id;
  }

  get type(): MemberType {
    return this._type;
  }

  get identityRef(): string {
    return this._identityRef;
  }

  get displayName(): string {
    return this._displayName;
  }

  get roles(): Role[] {
    return [...this._roles];
  }

  get isHuman(): boolean {
    return this._type === "human";
  }

  get isAgent(): boolean {
    return this._type === "agent";
  }

  /**
   * Peers in participation: both humans and agents can be assigned work
   * through the same mechanism. (Privilege over consequential actions is a
   * separate concern, enforced by the governance layer — not here.)
   */
  get canBeAssignedWork(): boolean {
    return true;
  }

  hasRole(role: Role): boolean {
    return this._roles.has(role);
  }

  hasAnyRole(roles: Role[]): boolean {
    return roles.some((role) => this._roles.has(role));
  }

  withRole(role: Role): Member {
    if (this._roles.has(role)) return this;
    return new Member({ ...this.toJSON(), roles: [...this._roles, role] });
  }

  withoutRole(role: Role): Member {
    if (!this._roles.has(role)) return this;
    return new Member({
      ...this.toJSON(),
      roles: [...this._roles].filter((r) => r !== role),
    });
  }

  toJSON(): MemberProps {
    return {
      id: this._id,
      type: this._type,
      identityRef: this._identityRef,
      displayName: this._displayName,
      roles: [...this._roles],
    };
  }
}

function requireNonBlank(field: string, value: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidMemberError(`${field} must be a non-blank string`);
  }
}
