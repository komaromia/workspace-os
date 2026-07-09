import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type Member, WorkItem, type WorkItemState } from "@workspace-os/core";
import * as schema from "../db/schema.js";

export class DrizzleWorkItemRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async save(item: WorkItem): Promise<void> {
    const props = item.toJSON();
    const values = {
      id: props.id,
      title: props.title,
      description: props.description,
      priority: props.priority,
      requiredRole: props.requiredRole,
      state: props.state,
      assigneeMemberId: props.assigneeMemberId,
      updatedAt: new Date(),
    };
    await this.db
      .insert(schema.workItems)
      .values(values)
      .onConflictDoUpdate({ target: schema.workItems.id, set: values });
  }

  async findById(id: string): Promise<WorkItem | null> {
    const rows = await this.db
      .select()
      .from(schema.workItems)
      .where(eq(schema.workItems.id, id))
      .limit(1);
    return rows[0] ? toWorkItem(rows[0]) : null;
  }

  async listOpen(): Promise<WorkItem[]> {
    const rows = await this.db
      .select()
      .from(schema.workItems)
      .where(eq(schema.workItems.state, "open"))
      .orderBy(desc(schema.workItems.priority), asc(schema.workItems.createdAt));
    return rows.map(toWorkItem);
  }

  /**
   * Atomically claims the highest-priority open item the member is eligible
   * for. FOR UPDATE SKIP LOCKED means concurrent claimers each lock a
   * different row, so an item is never handed to two workers. Returns null
   * when nothing eligible is available.
   */
  async claimNext(member: Member): Promise<WorkItem | null> {
    const roles = member.roles;
    // Eligible: unrestricted items, plus any whose required role the member holds.
    const eligibleRole =
      roles.length > 0
        ? or(isNull(schema.workItems.requiredRole), inArray(schema.workItems.requiredRole, roles))
        : isNull(schema.workItems.requiredRole);

    return this.db.transaction(async (tx) => {
      const candidates = await tx
        .select()
        .from(schema.workItems)
        .where(and(eq(schema.workItems.state, "open"), eligibleRole))
        .orderBy(desc(schema.workItems.priority), asc(schema.workItems.createdAt))
        .limit(1)
        .for("update", { skipLocked: true });

      const row = candidates[0];
      if (!row) return null;

      const claimed = toWorkItem(row).claimBy(member);
      await tx
        .update(schema.workItems)
        .set({
          state: claimed.state,
          assigneeMemberId: claimed.assigneeMemberId,
          updatedAt: new Date(),
        })
        .where(eq(schema.workItems.id, row.id));
      return claimed;
    });
  }
}

function toWorkItem(row: typeof schema.workItems.$inferSelect): WorkItem {
  return WorkItem.create({
    id: row.id,
    title: row.title,
    priority: row.priority,
    description: row.description,
    requiredRole: row.requiredRole,
    state: row.state as WorkItemState,
    assigneeMemberId: row.assigneeMemberId,
  });
}
