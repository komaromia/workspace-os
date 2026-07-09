import { and, asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  type ActivityLog,
  type ActivityRecord,
  type MemberType,
  type RecordActivityInput,
  UnknownActorError,
} from "@workspace-os/core";
import * as schema from "../db/schema.js";

const FOREIGN_KEY_VIOLATION = "23503";

export class DrizzleActivityLog implements ActivityLog {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async record(input: RecordActivityInput): Promise<ActivityRecord> {
    try {
      const [row] = await this.db
        .insert(schema.activities)
        .values({
          actorMemberId: input.actor.id,
          actorType: input.actor.type,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          metadata: input.metadata ?? {},
        })
        .returning();
      return toRecord(row!);
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new UnknownActorError(input.actor.id);
      }
      throw err;
    }
  }

  async listByActor(actorMemberId: string): Promise<ActivityRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.activities)
      .where(eq(schema.activities.actorMemberId, actorMemberId))
      .orderBy(asc(schema.activities.occurredAt), asc(schema.activities.id));
    return rows.map(toRecord);
  }

  async listByResource(resourceType: string, resourceId: string): Promise<ActivityRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.activities)
      .where(
        and(
          eq(schema.activities.resourceType, resourceType),
          eq(schema.activities.resourceId, resourceId),
        ),
      )
      .orderBy(asc(schema.activities.occurredAt), asc(schema.activities.id));
    return rows.map(toRecord);
  }
}

function toRecord(row: typeof schema.activities.$inferSelect): ActivityRecord {
  return {
    id: row.id,
    actorMemberId: row.actorMemberId,
    actorType: row.actorType as MemberType,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: row.metadata,
    occurredAt: row.occurredAt,
  };
}

function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && "code" in err && err.code === FOREIGN_KEY_VIOLATION
  );
}
