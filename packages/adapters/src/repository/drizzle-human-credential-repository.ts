import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  EmailAlreadyRegisteredError,
  type HumanCredentialRecord,
  type HumanCredentialRepository,
} from "@workspace-os/core";
import * as schema from "../db/schema.js";

const UNIQUE_VIOLATION = "23505";

export class DrizzleHumanCredentialRepository implements HumanCredentialRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async save(record: HumanCredentialRecord): Promise<void> {
    try {
      await this.db.insert(schema.humanCredentials).values({
        memberId: record.memberId,
        email: record.email,
        passwordHash: record.passwordHash,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new EmailAlreadyRegisteredError(record.email);
      }
      throw err;
    }
  }

  async findByEmail(email: string): Promise<HumanCredentialRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.humanCredentials)
      .where(eq(schema.humanCredentials.email, email))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { memberId: row.memberId, email: row.email, passwordHash: row.passwordHash };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === UNIQUE_VIOLATION;
}
