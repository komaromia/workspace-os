import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Persona, PersonaVersionConflictError, type PersonaRepository } from "@workspace-os/core";
import * as schema from "../db/schema.js";

export class DrizzlePersonaRepository implements PersonaRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async saveVersion(persona: Persona): Promise<void> {
    const props = persona.toJSON();
    const inserted = await this.db
      .insert(schema.personaVersions)
      .values({
        personaId: props.personaId,
        version: props.version,
        name: props.name,
        role: props.role,
        systemPrompt: props.systemPrompt,
        allowedTools: props.allowedTools,
        model: props.model,
      })
      .onConflictDoNothing()
      .returning({ version: schema.personaVersions.version });

    if (inserted.length === 0) {
      throw new PersonaVersionConflictError(props.personaId, props.version);
    }
  }

  async findVersion(personaId: string, version: number): Promise<Persona | null> {
    const rows = await this.db
      .select()
      .from(schema.personaVersions)
      .where(
        and(
          eq(schema.personaVersions.personaId, personaId),
          eq(schema.personaVersions.version, version),
        ),
      )
      .limit(1);
    return rows[0] ? toPersona(rows[0]) : null;
  }

  async findLatest(personaId: string): Promise<Persona | null> {
    const rows = await this.db
      .select()
      .from(schema.personaVersions)
      .where(eq(schema.personaVersions.personaId, personaId))
      .orderBy(desc(schema.personaVersions.version))
      .limit(1);
    return rows[0] ? toPersona(rows[0]) : null;
  }
}

function toPersona(row: typeof schema.personaVersions.$inferSelect): Persona {
  return Persona.create({
    personaId: row.personaId,
    name: row.name,
    role: row.role,
    systemPrompt: row.systemPrompt,
    allowedTools: row.allowedTools,
    model: row.model,
    version: row.version,
  });
}
