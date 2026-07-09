import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  Member,
  type MemberProps,
  type MemberRepository,
  type MemberType,
} from "@workspace-os/core";
import * as schema from "../db/schema.js";

export class DrizzleMemberRepository implements MemberRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async save(member: Member): Promise<void> {
    const props = member.toJSON();
    await this.db
      .insert(schema.members)
      .values({
        id: props.id,
        type: props.type,
        identityRef: props.identityRef,
        displayName: props.displayName,
        roles: props.roles,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.members.id,
        set: {
          type: props.type,
          identityRef: props.identityRef,
          displayName: props.displayName,
          roles: props.roles,
          updatedAt: new Date(),
        },
      });
  }

  async findById(id: string): Promise<Member | null> {
    const rows = await this.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, id))
      .limit(1);
    return rows[0] ? toMember(rows[0]) : null;
  }

  async findByIdentityRef(identityRef: string): Promise<Member | null> {
    const rows = await this.db
      .select()
      .from(schema.members)
      .where(eq(schema.members.identityRef, identityRef))
      .limit(1);
    return rows[0] ? toMember(rows[0]) : null;
  }
}

function toMember(row: typeof schema.members.$inferSelect): Member {
  const props: MemberProps = {
    id: row.id,
    type: row.type as MemberType,
    identityRef: row.identityRef,
    displayName: row.displayName,
    roles: row.roles,
  };
  return Member.create(props);
}
