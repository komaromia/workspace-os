import type { Member, MemberType } from "../domain/member.js";

export interface RecordActivityInput {
  /**
   * The acting principal. Taking a Member (never a bare string) is the
   * attribution guarantee (Epic 2): an activity cannot be recorded without a
   * principal, and humans and agents flow through the exact same call.
   */
  actor: Member;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityRecord {
  id: string;
  actorMemberId: string;
  actorType: MemberType;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

export interface ActivityLog {
  record(input: RecordActivityInput): Promise<ActivityRecord>;
  listByActor(actorMemberId: string): Promise<ActivityRecord[]>;
  listByResource(resourceType: string, resourceId: string): Promise<ActivityRecord[]>;
}

/**
 * Thrown when an activity is recorded for an actor that is not a known
 * member. Attribution is only meaningful if the actor is a real principal, so
 * this is enforced rather than allowed to record a dangling reference.
 */
export class UnknownActorError extends Error {
  constructor(public readonly actorMemberId: string) {
    super(`cannot attribute activity to unknown member: ${actorMemberId}`);
    this.name = "UnknownActorError";
  }
}
