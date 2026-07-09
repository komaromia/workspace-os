import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ActionDefinition } from "@workspace-os/governance";
import {
  PolicyDefinition,
  type PolicyRepository,
  PolicyVersionConflictError,
} from "@workspace-os/governance";
import * as schema from "../db/schema.js";

export class DrizzlePolicyRepository implements PolicyRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async saveVersion(policy: PolicyDefinition): Promise<void> {
    const props = policy.toJSON();
    const inserted = await this.db
      .insert(schema.policyVersions)
      .values({
        policyId: props.policyId,
        version: props.version,
        actions: props.actions,
      })
      .onConflictDoNothing()
      .returning({ version: schema.policyVersions.version });

    if (inserted.length === 0) {
      throw new PolicyVersionConflictError(props.policyId, props.version);
    }
  }

  async findVersion(policyId: string, version: number): Promise<PolicyDefinition | null> {
    const rows = await this.db
      .select()
      .from(schema.policyVersions)
      .where(
        and(
          eq(schema.policyVersions.policyId, policyId),
          eq(schema.policyVersions.version, version),
        ),
      )
      .limit(1);
    return rows[0] ? toPolicy(rows[0]) : null;
  }

  async findLatest(policyId: string): Promise<PolicyDefinition | null> {
    const rows = await this.db
      .select()
      .from(schema.policyVersions)
      .where(eq(schema.policyVersions.policyId, policyId))
      .orderBy(desc(schema.policyVersions.version))
      .limit(1);
    return rows[0] ? toPolicy(rows[0]) : null;
  }
}

function toPolicy(row: typeof schema.policyVersions.$inferSelect): PolicyDefinition {
  return PolicyDefinition.create({
    policyId: row.policyId,
    version: row.version,
    actions: row.actions as ActionDefinition[],
  });
}
