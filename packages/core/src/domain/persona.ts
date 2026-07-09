import type { Role } from "./member.js";

export interface PersonaModelConfig {
  modelId: string;
  temperature?: number;
  maxTokens?: number;
}

export interface PersonaProps {
  personaId: string;
  name: string;
  role: Role;
  systemPrompt: string;
  allowedTools: string[];
  model: PersonaModelConfig;
  /** Defaults to 1 on create; supplied when rehydrating a persisted version. */
  version?: number;
}

/** The subset of a persona that a revision may change. Identity fields
 * (personaId) and the version counter are not revisable directly. */
export type PersonaRevision = Partial<
  Pick<PersonaProps, "name" | "role" | "systemPrompt" | "allowedTools" | "model">
>;

export class InvalidPersonaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPersonaError";
  }
}

/**
 * A versioned agent persona: system prompt, allowed tools, model config, and
 * role (Epic 2). Versions are immutable — `revise` produces a new Persona
 * with the version bumped, leaving the prior version untouched. This is the
 * hook Epic 16 (model governance) needs: every persona change ships a new,
 * inventoried version rather than mutating one in place.
 */
export class Persona {
  private readonly _personaId: string;
  private readonly _name: string;
  private readonly _role: Role;
  private readonly _systemPrompt: string;
  private readonly _allowedTools: ReadonlySet<string>;
  private readonly _model: PersonaModelConfig;
  private readonly _version: number;

  private constructor(props: Required<PersonaProps>) {
    this._personaId = props.personaId;
    this._name = props.name;
    this._role = props.role;
    this._systemPrompt = props.systemPrompt;
    this._allowedTools = new Set(props.allowedTools);
    this._model = { ...props.model };
    this._version = props.version;
  }

  static create(props: PersonaProps): Persona {
    requireNonBlank("personaId", props.personaId);
    requireNonBlank("name", props.name);
    requireNonBlank("role", props.role);
    requireNonBlank("systemPrompt", props.systemPrompt);
    validateModel(props.model);
    const version = props.version ?? 1;
    if (!Number.isInteger(version) || version < 1) {
      throw new InvalidPersonaError(`version must be an integer >= 1, got ${String(version)}`);
    }
    return new Persona({ ...props, version });
  }

  get personaId(): string {
    return this._personaId;
  }

  get name(): string {
    return this._name;
  }

  get role(): Role {
    return this._role;
  }

  get systemPrompt(): string {
    return this._systemPrompt;
  }

  get allowedTools(): string[] {
    return [...this._allowedTools];
  }

  get model(): PersonaModelConfig {
    return { ...this._model };
  }

  get version(): number {
    return this._version;
  }

  allowsTool(tool: string): boolean {
    return this._allowedTools.has(tool);
  }

  revise(changes: PersonaRevision): Persona {
    return Persona.create({
      ...this.toJSON(),
      ...changes,
      version: this._version + 1,
    });
  }

  toJSON(): Required<PersonaProps> {
    return {
      personaId: this._personaId,
      name: this._name,
      role: this._role,
      systemPrompt: this._systemPrompt,
      allowedTools: [...this._allowedTools],
      model: { ...this._model },
      version: this._version,
    };
  }
}

function requireNonBlank(field: string, value: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidPersonaError(`${field} must be a non-blank string`);
  }
}

function validateModel(model: PersonaModelConfig): void {
  requireNonBlank("model.modelId", model.modelId);
  if (model.temperature !== undefined && (model.temperature < 0 || model.temperature > 2)) {
    throw new InvalidPersonaError(
      `model.temperature must be within [0, 2], got ${model.temperature}`,
    );
  }
  if (
    model.maxTokens !== undefined &&
    (!Number.isInteger(model.maxTokens) || model.maxTokens < 1)
  ) {
    throw new InvalidPersonaError(
      `model.maxTokens must be a positive integer, got ${model.maxTokens}`,
    );
  }
}
