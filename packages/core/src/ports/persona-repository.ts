import type { Persona } from "../domain/persona.js";

export interface PersonaRepository {
  /**
   * Persist a persona version. Versions are immutable, so saving a
   * (personaId, version) that already exists is a conflict, not an update.
   */
  saveVersion(persona: Persona): Promise<void>;
  findVersion(personaId: string, version: number): Promise<Persona | null>;
  /** The highest-versioned persona for the given id, or null if none. */
  findLatest(personaId: string): Promise<Persona | null>;
}

export class PersonaVersionConflictError extends Error {
  constructor(
    public readonly personaId: string,
    public readonly version: number,
  ) {
    super(`persona ${personaId} version ${version} already exists (versions are immutable)`);
    this.name = "PersonaVersionConflictError";
  }
}
